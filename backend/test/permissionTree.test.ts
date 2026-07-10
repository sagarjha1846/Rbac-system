import { beforeAll, describe, expect, it } from "vitest";
import { resetTestDb } from "./testUtils";
import * as rbac from "../src/services/rbac";
import { resolvePermissionTree, userCan } from "../src/services/permissionTree";
import { prisma } from "../src/db";

describe("permission tree resolution", () => {
  beforeAll(async () => {
    await resetTestDb();

    await rbac.createApplication({ name: "Supply Chain Finance", key: "scf" });
    await rbac.createModule({ applicationKey: "scf", name: "Vendor", key: "vendor", moduleType: "MENU" });
    await rbac.createModule({ applicationKey: "scf", name: "Program", key: "program", moduleType: "MENU" });

    const vendorPermission = await rbac.createPermission({
      applicationKey: "scf",
      moduleKey: "vendor",
      canRead: true,
      canAdd: true,
    });
    await rbac.createPermissionGroup({ name: "Vendor Manager", key: "vendor-manager" });
    await rbac.addPermissionToGroup({ permissionId: vendorPermission.id, permissionGroupKey: "vendor-manager" });

    const user = await rbac.createUser({
      firstName: "Rajesh",
      lastName: "Kumar",
      email: "rajesh@test.local",
      password: "Temp@1234",
      role: "Originator",
    });
    await rbac.assignUserToApplication({ userId: user.id, applicationKey: "scf" });
    await rbac.assignUserToGroup({ userId: user.id, permissionGroupKey: "vendor-manager" });
  });

  it("resolves exactly the granted module and permissions, nothing more", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "rajesh@test.local" } });
    const tree = await resolvePermissionTree(user.id);

    expect(tree).toHaveLength(1);
    expect(tree[0].applicationKey).toBe("scf");
    expect(tree[0].modules).toHaveLength(1);

    const vendorModule = tree[0].modules[0];
    expect(vendorModule.moduleKey).toBe("vendor");
    expect(vendorModule.canRead).toBe(true);
    expect(vendorModule.canAdd).toBe(true);
    expect(vendorModule.canModify).toBe(false);
    expect(vendorModule.canDelete).toBe(false);
  });

  it("userCan is true for granted module+action, false for ungranted ones", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "rajesh@test.local" } });

    expect(await userCan(user.id, "vendor", "read")).toBe(true);
    expect(await userCan(user.id, "vendor", "add")).toBe(true);
    expect(await userCan(user.id, "vendor", "delete")).toBe(false);
    // Program module was created but never granted to this user's group.
    expect(await userCan(user.id, "program", "read")).toBe(false);
  });

  it("returns an empty tree for a user with no group memberships", async () => {
    const user = await rbac.createUser({
      firstName: "No",
      lastName: "Access",
      email: "noaccess@test.local",
      password: "Temp@1234",
      role: "Vendor",
    });
    const tree = await resolvePermissionTree(user.id);
    expect(tree).toEqual([]);
  });
});

describe("data-scoped permissions", () => {
  beforeAll(async () => {
    await resetTestDb();

    await rbac.createApplication({ name: "Supply Chain Finance", key: "scf" });
    await rbac.createModule({ applicationKey: "scf", name: "Program", key: "program", moduleType: "MENU" });
    await rbac.createMasterGroup({ name: "Anchor", key: "anchor" });
    const acme = await rbac.createMasterData({ masterGroupKey: "anchor", name: "Acme Manufacturing", code: "ACME001" });

    const scopedPermission = await rbac.createPermission({
      applicationKey: "scf",
      moduleKey: "program",
      canRead: true,
    });
    await rbac.scopePermissionToData({ permissionId: scopedPermission.id, masterDataId: acme.id });

    await rbac.createPermissionGroup({ name: "Acme Anchor User", key: "acme-anchor-user" });
    await rbac.addPermissionToGroup({ permissionId: scopedPermission.id, permissionGroupKey: "acme-anchor-user" });

    const user = await rbac.createUser({
      firstName: "Anchor",
      lastName: "User",
      email: "anchor@test.local",
      password: "Temp@1234",
      role: "Anchor",
    });
    await rbac.assignUserToApplication({ userId: user.id, applicationKey: "scf" });
    await rbac.assignUserToGroup({ userId: user.id, permissionGroupKey: "acme-anchor-user" });
  });

  it("surfaces which specific master-data record a module grant is scoped to", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "anchor@test.local" } });
    const tree = await resolvePermissionTree(user.id);

    const programModule = tree[0].modules.find((m) => m.moduleKey === "program")!;
    expect(programModule.scopedData).toHaveLength(1);
    expect(programModule.scopedData[0].name).toBe("Acme Manufacturing");
    expect(programModule.scopedData[0].masterGroupKey).toBe("anchor");
  });
});
