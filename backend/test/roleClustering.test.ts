import { beforeAll, describe, expect, it } from "vitest";
import { resetTestDb } from "./testUtils";
import * as rbac from "../src/services/rbac";
import { suggestRoleClusters } from "../src/services/roleClustering";

describe("role clustering", () => {
  beforeAll(async () => {
    await resetTestDb();

    await rbac.createApplication({ name: "Supply Chain Finance", key: "scf" });
    await rbac.createModule({ applicationKey: "scf", name: "Vendor", key: "vendor", moduleType: "MENU" });

    // Two hand-built groups end up granting the identical permission set -
    // classic role explosion: one group per user instead of one shared group.
    const permA = await rbac.createPermission({ applicationKey: "scf", moduleKey: "vendor", canRead: true, canAdd: true });
    const permB = await rbac.createPermission({ applicationKey: "scf", moduleKey: "vendor", canRead: true, canAdd: true });

    await rbac.createPermissionGroup({ name: "Vendor Ops - Priya", key: "vendor-ops-priya" });
    await rbac.addPermissionToGroup({ permissionId: permA.id, permissionGroupKey: "vendor-ops-priya" });
    const priya = await rbac.createUser({
      firstName: "Priya",
      lastName: "S",
      email: "priya@test.local",
      password: "Temp@1234",
      role: "Originator",
    });
    await rbac.assignUserToGroup({ userId: priya.id, permissionGroupKey: "vendor-ops-priya" });

    await rbac.createPermissionGroup({ name: "Vendor Ops - Kabir", key: "vendor-ops-kabir" });
    await rbac.addPermissionToGroup({ permissionId: permB.id, permissionGroupKey: "vendor-ops-kabir" });
    const kabir = await rbac.createUser({
      firstName: "Kabir",
      lastName: "R",
      email: "kabir@test.local",
      password: "Temp@1234",
      role: "Originator",
    });
    await rbac.assignUserToGroup({ userId: kabir.id, permissionGroupKey: "vendor-ops-kabir" });

    // A third group with a genuinely different permission set should not cluster with the above.
    const permC = await rbac.createPermission({ applicationKey: "scf", moduleKey: "vendor", canDelete: true });
    await rbac.createPermissionGroup({ name: "Vendor Super Admin", key: "vendor-super-admin" });
    await rbac.addPermissionToGroup({ permissionId: permC.id, permissionGroupKey: "vendor-super-admin" });
  });

  it("suggests merging groups with an identical permission signature", async () => {
    const suggestions = await suggestRoleClusters();

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].groupKeys.sort()).toEqual(["vendor-ops-kabir", "vendor-ops-priya"]);
    expect(suggestions[0].totalUsers).toBe(2);
  });

  it("does not suggest merging a group with a unique permission signature", async () => {
    const suggestions = await suggestRoleClusters();
    const flatKeys = suggestions.flatMap((s) => s.groupKeys);
    expect(flatKeys).not.toContain("vendor-super-admin");
  });
});
