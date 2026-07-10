import * as rbac from "../src/services/rbac";
import { prisma } from "../src/db";

async function main() {
  // --- Bootstrap: the "system" application holds RBAC administration itself,
  // so the very first admin user can manage everything else (including via chat).
  await rbac.createApplication({ name: "System", key: "system", description: "RBAC administration" });
  const adminModule = await rbac.createModule({
    applicationKey: "system",
    name: "RBAC Admin",
    key: "rbac-admin",
    description: "Manage users, modules, permissions and groups",
    moduleType: "MENU",
  });
  const adminPermission = await rbac.createPermission({
    applicationKey: "system",
    moduleKey: "rbac-admin",
    canRead: true,
    canAdd: true,
    canModify: true,
    canDelete: true,
  });
  await rbac.createPermissionGroup({ name: "System Admin", key: "system-admin", description: "Full RBAC admin access" });
  await rbac.addPermissionToGroup({ permissionId: adminPermission.id, permissionGroupKey: "system-admin" });

  const existingAdmin = await rbac.findUserByEmail("admin@example.com");
  const admin = existingAdmin ?? (await rbac.createUser({
    firstName: "System",
    lastName: "Admin",
    email: "admin@example.com",
    password: "Admin@123",
    role: "Originator",
  }));
  await rbac.assignUserToApplication({ userId: admin.id, applicationKey: "system" });
  await rbac.assignUserToGroup({ userId: admin.id, permissionGroupKey: "system-admin" });

  // --- Demo domain: supply chain finance, to give the chat agent something
  // realistic to extend (roles referenced in the design doc).
  await rbac.createApplication({
    name: "Supply Chain Finance",
    key: "scf",
    description: "Invoice financing between anchors, vendors, co-lenders and the originator",
  });
  await rbac.createModule({ applicationKey: "scf", name: "Program", key: "program", moduleType: "MENU", order: 1 });
  await rbac.createModule({ applicationKey: "scf", name: "Anchor", key: "anchor", moduleType: "MENU", order: 2 });
  await rbac.createModule({ applicationKey: "scf", name: "Vendor", key: "vendor", moduleType: "MENU", order: 3 });
  await rbac.createModule({ applicationKey: "scf", name: "Co-lender", key: "co-lender", moduleType: "MENU", order: 4 });

  for (const role of ["Anchor", "Vendor", "Co-lender", "Originator"]) {
    await rbac.createMasterGroup({ name: role, key: role.toLowerCase().replace(/\s+/g, "-") });
  }
  await rbac.createMasterData({ masterGroupKey: "anchor", name: "Acme Manufacturing Ltd", code: "ACMEPAN001" });

  console.log("Seed complete. Admin login: admin@example.com / Admin@123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
