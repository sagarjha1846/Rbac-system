import { prisma } from "../src/db";

// Wipes the test database between test files - child tables first to
// respect foreign keys. Only ever point this at rbac_system_test (see
// backend/.env.test); never run against a real database.
export async function resetTestDb() {
  const dbUrl = process.env.DATABASE_URL || "";
  if (process.env.NODE_ENV !== "test" || !dbUrl.includes("test")) {
    throw new Error("resetTestDb refused to run: DATABASE_URL does not look like a test database");
  }

  await prisma.permissionDataMapping.deleteMany();
  await prisma.permissionGroupUserMapping.deleteMany();
  await prisma.permissionGroupMapping.deleteMany();
  await prisma.applicationUserMapping.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.masterDataStorage.deleteMany();
  await prisma.masterGroupStorage.deleteMany();
  await prisma.module.deleteMany();
  await prisma.permissionGroup.deleteMany();
  await prisma.user.deleteMany();
  await prisma.application.deleteMany();
}
