import { beforeAll, describe, expect, it } from "vitest";
import { resetTestDb } from "./testUtils";
import * as rbac from "../src/services/rbac";
import { prisma } from "../src/db";
import { resolvePermissionTree } from "../src/services/permissionTree";
import { revokeExpiredAccess } from "../src/services/expiry";

describe("time-boxed access expiry", () => {
  beforeAll(async () => {
    await resetTestDb();

    await rbac.createApplication({ name: "Analytics", key: "analytics" });
    await rbac.createModule({ applicationKey: "analytics", name: "Dashboards", key: "dashboards", moduleType: "MENU" });
    const permission = await rbac.createPermission({ applicationKey: "analytics", moduleKey: "dashboards", canRead: true });
    await rbac.createPermissionGroup({ name: "Analytics Read Only", key: "analytics-read-only" });
    await rbac.addPermissionToGroup({ permissionId: permission.id, permissionGroupKey: "analytics-read-only" });
  });

  it("excludes an already-expired grant from the resolved permission tree", async () => {
    const user = await rbac.createUser({
      firstName: "Expired",
      lastName: "Grant",
      email: "expired@test.local",
      password: "Temp@1234",
      role: "Vendor",
    });
    await rbac.assignUserToGroup({
      userId: user.id,
      permissionGroupKey: "analytics-read-only",
      expiresAt: new Date(Date.now() - 60_000), // one minute in the past
    });

    const tree = await resolvePermissionTree(user.id);
    expect(tree).toEqual([]);
  });

  it("still includes a grant whose expiry is in the future", async () => {
    const user = await rbac.createUser({
      firstName: "Active",
      lastName: "Grant",
      email: "active@test.local",
      password: "Temp@1234",
      role: "Vendor",
    });
    await rbac.assignUserToGroup({
      userId: user.id,
      permissionGroupKey: "analytics-read-only",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // one hour from now
    });

    const tree = await resolvePermissionTree(user.id);
    expect(tree[0].modules[0].moduleKey).toBe("dashboards");
  });

  it("revokeExpiredAccess deletes lapsed memberships and logs a SYSTEM audit entry, leaving active ones alone", async () => {
    const before = await prisma.permissionGroupUserMapping.count();
    expect(before).toBeGreaterThan(0);

    const result = await revokeExpiredAccess();
    expect(result.revoked).toBe(1); // only the "Expired Grant" user's membership

    const expiredUser = await rbac.findUserByEmail("expired@test.local");
    const remaining = await prisma.permissionGroupUserMapping.findMany({ where: { userId: expiredUser!.id } });
    expect(remaining).toHaveLength(0);

    const activeUser = await rbac.findUserByEmail("active@test.local");
    const stillThere = await prisma.permissionGroupUserMapping.findMany({ where: { userId: activeUser!.id } });
    expect(stillThere).toHaveLength(1);

    const auditEntry = await prisma.auditLog.findFirst({ where: { action: "access.expire" } });
    expect(auditEntry).toBeTruthy();
    expect(auditEntry!.source).toBe("SYSTEM");

    // Running it again should be a no-op.
    const secondRun = await revokeExpiredAccess();
    expect(secondRun.revoked).toBe(0);
  });
});
