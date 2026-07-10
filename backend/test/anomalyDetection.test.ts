import { beforeAll, describe, expect, it } from "vitest";
import { resetTestDb } from "./testUtils";
import * as rbac from "../src/services/rbac";
import { prisma } from "../src/db";
import { detectOverPrivilegedUsers } from "../src/services/anomalyDetection";

describe("over-privilege / latent-grant detection", () => {
  beforeAll(async () => {
    await resetTestDb();

    await rbac.createApplication({ name: "Supply Chain Finance", key: "scf" });
    await rbac.createModule({ applicationKey: "scf", name: "Vendor", key: "vendor", moduleType: "MENU" });
    await rbac.createModule({ applicationKey: "scf", name: "Program", key: "program", moduleType: "MENU" });

    const vendorPermission = await rbac.createPermission({
      applicationKey: "scf",
      moduleKey: "vendor",
      canRead: true,
      canDelete: true, // risky, granted but never exercised below
    });
    const programPermission = await rbac.createPermission({
      applicationKey: "scf",
      moduleKey: "program",
      canRead: true,
    });

    await rbac.createPermissionGroup({ name: "Vendor Manager", key: "vendor-manager" });
    await rbac.addPermissionToGroup({ permissionId: vendorPermission.id, permissionGroupKey: "vendor-manager" });
    await rbac.addPermissionToGroup({ permissionId: programPermission.id, permissionGroupKey: "vendor-manager" });

    const user = await rbac.createUser({
      firstName: "Rajesh",
      lastName: "Kumar",
      email: "rajesh@test.local",
      password: "Temp@1234",
      role: "Originator",
    });
    await rbac.assignUserToGroup({ userId: user.id, permissionGroupKey: "vendor-manager" });

    // Simulate real usage: only ever exercised vendor:read and program:read -
    // vendor:delete was granted but never used.
    await prisma.accessActivityLog.createMany({
      data: [
        { userId: user.id, moduleKey: "vendor", action: "read" },
        { userId: user.id, moduleKey: "program", action: "read" },
      ],
    });
  });

  it("flags an unused risky grant (delete) while ignoring exercised grants", async () => {
    const results = await detectOverPrivilegedUsers();
    const rajesh = results.find((r) => r.email === "rajesh@test.local");

    expect(rajesh).toBeTruthy();
    expect(rajesh!.latentGrants).toHaveLength(1);
    expect(rajesh!.latentGrants[0]).toEqual({ moduleKey: "vendor", action: "delete", risky: true });
  });
});
