import { prisma } from "../db";
import { hashPassword } from "../auth/password";

export async function createApplication(input: { name: string; key: string; description?: string }) {
  return prisma.application.upsert({
    where: { key: input.key },
    update: {},
    create: input,
  });
}

export async function findApplicationByKey(key: string) {
  return prisma.application.findUnique({ where: { key } });
}

export async function listApplications() {
  return prisma.application.findMany();
}

export async function createModule(input: {
  applicationKey: string;
  name: string;
  key: string;
  description?: string;
  order?: number;
  moduleType?: "BASIC" | "MENU" | "TAB";
  moduleRoute?: string;
}) {
  const application = await findApplicationByKey(input.applicationKey);
  if (!application) {
    throw new Error(`Application '${input.applicationKey}' does not exist`);
  }
  return prisma.module.upsert({
    where: { applicationId_key: { applicationId: application.id, key: input.key } },
    update: {},
    create: {
      applicationId: application.id,
      name: input.name,
      key: input.key,
      description: input.description,
      order: input.order ?? 0,
      moduleType: input.moduleType ?? "BASIC",
      moduleRoute: input.moduleRoute,
    },
  });
}

export async function listModules(applicationKey?: string) {
  if (!applicationKey) return prisma.module.findMany({ include: { application: true } });
  const application = await findApplicationByKey(applicationKey);
  if (!application) throw new Error(`Application '${applicationKey}' does not exist`);
  return prisma.module.findMany({ where: { applicationId: application.id } });
}

export async function findModuleByKey(applicationKey: string, moduleKey: string) {
  const application = await findApplicationByKey(applicationKey);
  if (!application) return null;
  return prisma.module.findUnique({
    where: { applicationId_key: { applicationId: application.id, key: moduleKey } },
  });
}

export async function createPermission(input: {
  applicationKey: string;
  moduleKey: string;
  canRead?: boolean;
  canAdd?: boolean;
  canModify?: boolean;
  canDelete?: boolean;
  parentPermissionId?: string;
}) {
  const module = await findModuleByKey(input.applicationKey, input.moduleKey);
  if (!module) {
    throw new Error(`Module '${input.moduleKey}' does not exist in application '${input.applicationKey}'`);
  }
  return prisma.permission.create({
    data: {
      moduleId: module.id,
      canRead: input.canRead ?? false,
      canAdd: input.canAdd ?? false,
      canModify: input.canModify ?? false,
      canDelete: input.canDelete ?? false,
      parentPermissionId: input.parentPermissionId,
    },
  });
}

export async function createPermissionGroup(input: { name: string; key: string; description?: string; type?: string }) {
  return prisma.permissionGroup.upsert({
    where: { key: input.key },
    update: {},
    create: { ...input, type: input.type ?? "custom" },
  });
}

export async function findPermissionGroupByKey(key: string) {
  return prisma.permissionGroup.findUnique({ where: { key } });
}

export async function listPermissionGroups() {
  return prisma.permissionGroup.findMany({
    include: { permissions: { include: { permission: { include: { module: true } } } } },
  });
}

export async function addPermissionToGroup(input: { permissionId: string; permissionGroupKey: string }) {
  const group = await findPermissionGroupByKey(input.permissionGroupKey);
  if (!group) throw new Error(`Permission group '${input.permissionGroupKey}' does not exist`);
  return prisma.permissionGroupMapping.upsert({
    where: { permissionId_permissionGroupId: { permissionId: input.permissionId, permissionGroupId: group.id } },
    update: {},
    create: { permissionId: input.permissionId, permissionGroupId: group.id },
  });
}

export async function createUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  isActive?: boolean;
}) {
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash,
      role: input.role,
      isActive: input.isActive ?? true,
    },
  });
}

export async function listUsers() {
  return prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function assignUserToApplication(input: { userId: string; applicationKey: string }) {
  const application = await findApplicationByKey(input.applicationKey);
  if (!application) throw new Error(`Application '${input.applicationKey}' does not exist`);
  return prisma.applicationUserMapping.upsert({
    where: { applicationId_userId: { applicationId: application.id, userId: input.userId } },
    update: {},
    create: { applicationId: application.id, userId: input.userId },
  });
}

export async function assignUserToGroup(input: { userId: string; permissionGroupKey: string }) {
  const group = await findPermissionGroupByKey(input.permissionGroupKey);
  if (!group) throw new Error(`Permission group '${input.permissionGroupKey}' does not exist`);
  return prisma.permissionGroupUserMapping.upsert({
    where: { permissionGroupId_userId: { permissionGroupId: group.id, userId: input.userId } },
    update: {},
    create: { permissionGroupId: group.id, userId: input.userId },
  });
}

export async function createMasterGroup(input: { name: string; key: string; description?: string }) {
  return prisma.masterGroupStorage.upsert({
    where: { key: input.key },
    update: {},
    create: input,
  });
}

export async function createMasterData(input: { masterGroupKey: string; name: string; code?: string; description?: string }) {
  const group = await prisma.masterGroupStorage.findUnique({ where: { key: input.masterGroupKey } });
  if (!group) throw new Error(`Master group '${input.masterGroupKey}' does not exist`);
  return prisma.masterDataStorage.create({
    data: { masterGroupId: group.id, name: input.name, code: input.code, description: input.description },
  });
}

export async function scopePermissionToData(input: { permissionId: string; masterDataId: string }) {
  return prisma.permissionDataMapping.upsert({
    where: { permissionId_masterDataId: { permissionId: input.permissionId, masterDataId: input.masterDataId } },
    update: {},
    create: input,
  });
}
