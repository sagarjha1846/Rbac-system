import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { resetTestDb } from "./testUtils";
import * as rbac from "../src/services/rbac";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { FakeLLMAdapter } from "./fakeLlm";
import {
  draftProvisioningRequest,
  approveProvisioningRequest,
  rejectProvisioningRequest,
} from "../src/services/provisioning";
import { resolvePermissionTree } from "../src/services/permissionTree";

const app = createApp();

async function seedBaseline() {
  await resetTestDb();

  await rbac.createApplication({ name: "System", key: "system" });
  await rbac.createModule({ applicationKey: "system", name: "RBAC Admin", key: "rbac-admin", moduleType: "MENU" });
  const adminPermission = await rbac.createPermission({
    applicationKey: "system",
    moduleKey: "rbac-admin",
    canRead: true,
    canAdd: true,
    canModify: true,
    canDelete: true,
  });
  await rbac.createPermissionGroup({ name: "System Admin", key: "system-admin" });
  await rbac.addPermissionToGroup({ permissionId: adminPermission.id, permissionGroupKey: "system-admin" });

  const admin = await rbac.createUser({
    firstName: "Test",
    lastName: "Admin",
    email: "admin@test.local",
    password: "Admin@1234",
    role: "Originator",
  });
  await rbac.assignUserToApplication({ userId: admin.id, applicationKey: "system" });
  await rbac.assignUserToGroup({ userId: admin.id, permissionGroupKey: "system-admin" });

  await rbac.createApplication({ name: "Analytics", key: "analytics" });
  await rbac.createModule({ applicationKey: "analytics", name: "Dashboards", key: "dashboards", moduleType: "MENU" });
  await rbac.createPermissionGroup({ name: "Analytics Read Only", key: "analytics-read-only" });
  const readPermission = await rbac.createPermission({
    applicationKey: "analytics",
    moduleKey: "dashboards",
    canRead: true,
  });
  await rbac.addPermissionToGroup({ permissionId: readPermission.id, permissionGroupKey: "analytics-read-only" });

  const intern = await rbac.createUser({
    firstName: "Marketing",
    lastName: "Intern",
    email: "intern@test.local",
    password: "Intern@1234",
    role: "Marketing",
  });

  return { admin, intern };
}

describe("HITL provisioning service layer", () => {
  it("drafting a request never executes anything - the target user gets no access yet", async () => {
    const { intern } = await seedBaseline();

    const fakeLlm = new FakeLLMAdapter(
      JSON.stringify({
        type: "assign_existing_user_to_group",
        targetEmail: "intern@test.local",
        permissionGroupKey: "analytics-read-only",
      })
    );

    const request = await draftProvisioningRequest(
      "Give the new marketing intern temporary read-only access to analytics",
      undefined,
      fakeLlm
    );

    expect(request.status).toBe("PENDING_APPROVAL");

    const tree = await resolvePermissionTree(intern.id);
    expect(tree).toEqual([]); // nothing granted yet - still pending

    const auditEntries = await prisma.auditLog.findMany({ where: { entityId: request.id } });
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].source).toBe("AI_DRAFTED");
    expect(auditEntries[0].action).toBe("provisioning.draft");
  });

  it("approving a request executes the drafted action and logs it", async () => {
    const { admin, intern } = await seedBaseline();
    const fakeLlm = new FakeLLMAdapter(
      JSON.stringify({
        type: "assign_existing_user_to_group",
        targetEmail: "intern@test.local",
        permissionGroupKey: "analytics-read-only",
      })
    );

    const request = await draftProvisioningRequest("read-only analytics for the intern", undefined, fakeLlm);
    const approved = await approveProvisioningRequest(request.id, admin.id);

    expect(approved.status).toBe("EXECUTED");
    expect(approved.reviewedById).toBe(admin.id);

    const tree = await resolvePermissionTree(intern.id);
    expect(tree[0].modules[0].moduleKey).toBe("dashboards");
    expect(tree[0].modules[0].canRead).toBe(true);

    const approveAudit = await prisma.auditLog.findFirst({
      where: { entityId: request.id, action: "provisioning.approve" },
    });
    expect(approveAudit).toBeTruthy();
    expect(approveAudit!.source).toBe("AI_DRAFTED");
  });

  it("rejecting a request leaves the target user with no access and logs the rejection", async () => {
    const { admin, intern } = await seedBaseline();
    const fakeLlm = new FakeLLMAdapter(
      JSON.stringify({
        type: "assign_existing_user_to_group",
        targetEmail: "intern@test.local",
        permissionGroupKey: "analytics-read-only",
      })
    );

    const request = await draftProvisioningRequest("read-only analytics for the intern", undefined, fakeLlm);
    const rejected = await rejectProvisioningRequest(request.id, admin.id, "Not approved by manager");

    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("Not approved by manager");

    const tree = await resolvePermissionTree(intern.id);
    expect(tree).toEqual([]);

    const rejectAudit = await prisma.auditLog.findFirst({
      where: { entityId: request.id, action: "provisioning.reject" },
    });
    expect(rejectAudit).toBeTruthy();
  });

  it("refuses to approve or reject a request that isn't pending", async () => {
    const { admin } = await seedBaseline();
    const fakeLlm = new FakeLLMAdapter(
      JSON.stringify({
        type: "assign_existing_user_to_group",
        targetEmail: "intern@test.local",
        permissionGroupKey: "analytics-read-only",
      })
    );
    const request = await draftProvisioningRequest("prompt", undefined, fakeLlm);
    await approveProvisioningRequest(request.id, admin.id);

    await expect(approveProvisioningRequest(request.id, admin.id)).rejects.toThrow();
    await expect(rejectProvisioningRequest(request.id, admin.id)).rejects.toThrow();
  });
});

describe("provisioning routes - permission gating", () => {
  it("lets any authenticated user submit a draft, but only rbac-admins can list/approve/reject", async () => {
    await seedBaseline();

    const internLogin = await request(app)
      .post("/auth/login")
      .send({ email: "intern@test.local", password: "Intern@1234" });
    const adminLogin = await request(app)
      .post("/auth/login")
      .send({ email: "admin@test.local", password: "Admin@1234" });

    // A plain user with no rbac-admin permission cannot list or approve, but a
    // request record must exist for the 403 to be meaningfully about
    // authorization rather than a 404 - insert one directly.
    const seeded = await prisma.provisioningRequest.create({
      data: {
        prompt: "test",
        draftedAction: { type: "assign_existing_user_to_group", targetEmail: "intern@test.local", permissionGroupKey: "analytics-read-only" },
      },
    });

    const listAsIntern = await request(app).get("/provisioning").set("Authorization", `Bearer ${internLogin.body.token}`);
    expect(listAsIntern.status).toBe(403);

    const approveAsIntern = await request(app)
      .post(`/provisioning/${seeded.id}/approve`)
      .set("Authorization", `Bearer ${internLogin.body.token}`);
    expect(approveAsIntern.status).toBe(403);

    const listAsAdmin = await request(app).get("/provisioning").set("Authorization", `Bearer ${adminLogin.body.token}`);
    expect(listAsAdmin.status).toBe(200);
    expect(Array.isArray(listAsAdmin.body)).toBe(true);
  });

  it("401s draft submission with no token", async () => {
    const res = await request(app).post("/provisioning/draft").send({ prompt: "anything" });
    expect(res.status).toBe(401);
  });
});
