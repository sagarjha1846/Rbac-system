import { prisma } from "../db";

export interface ModulePermission {
  moduleKey: string;
  moduleName: string;
  moduleType: string;
  moduleRoute: string | null;
  canRead: boolean;
  canAdd: boolean;
  canModify: boolean;
  canDelete: boolean;
  // If non-empty, access to this module is restricted to these specific
  // master-data records (e.g. "only Anchor X's Program"). Empty = module-wide access.
  scopedData: { masterGroupKey: string; masterDataId: string; name: string; code: string | null }[];
}

export interface ApplicationPermissions {
  applicationKey: string;
  applicationName: string;
  modules: ModulePermission[];
}

export type PermissionTree = ApplicationPermissions[];

/**
 * Resolves everything a user can do: walks
 * user -> groups -> group permissions -> module (+ application), merging
 * duplicate module grants and attaching any data-level scoping.
 * This is the single source of truth consumed by both the frontend
 * (to build menus/CTAs) and the backend guard middleware.
 */
export async function resolvePermissionTree(userId: string): Promise<PermissionTree> {
  const allowedApplicationIds = new Set(
    (await prisma.applicationUserMapping.findMany({ where: { userId } })).map((m) => m.applicationId)
  );

  const groupMemberships = await prisma.permissionGroupUserMapping.findMany({ where: { userId } });
  const groupIds = groupMemberships.map((g) => g.permissionGroupId);
  if (groupIds.length === 0) return [];

  const groupPermissionMappings = await prisma.permissionGroupMapping.findMany({
    where: { permissionGroupId: { in: groupIds } },
    include: {
      permission: {
        include: {
          module: { include: { application: true } },
          dataMappings: { include: { masterData: { include: { masterGroup: true } } } },
        },
      },
    },
  });

  const byApplication = new Map<string, ApplicationPermissions>();

  for (const mapping of groupPermissionMappings) {
    const permission = mapping.permission;
    const module = permission.module;
    const application = module.application;

    if (allowedApplicationIds.size > 0 && !allowedApplicationIds.has(application.id)) continue;

    if (!byApplication.has(application.id)) {
      byApplication.set(application.id, { applicationKey: application.key, applicationName: application.name, modules: [] });
    }
    const appEntry = byApplication.get(application.id)!;

    let moduleEntry = appEntry.modules.find((m) => m.moduleKey === module.key);
    if (!moduleEntry) {
      moduleEntry = {
        moduleKey: module.key,
        moduleName: module.name,
        moduleType: module.moduleType,
        moduleRoute: module.moduleRoute,
        canRead: false,
        canAdd: false,
        canModify: false,
        canDelete: false,
        scopedData: [],
      };
      appEntry.modules.push(moduleEntry);
    }

    moduleEntry.canRead = moduleEntry.canRead || permission.canRead;
    moduleEntry.canAdd = moduleEntry.canAdd || permission.canAdd;
    moduleEntry.canModify = moduleEntry.canModify || permission.canModify;
    moduleEntry.canDelete = moduleEntry.canDelete || permission.canDelete;

    for (const dm of permission.dataMappings) {
      moduleEntry.scopedData.push({
        masterGroupKey: dm.masterData.masterGroup.key,
        masterDataId: dm.masterData.id,
        name: dm.masterData.name,
        code: dm.masterData.code,
      });
    }
  }

  return Array.from(byApplication.values());
}

export type Action = "read" | "add" | "modify" | "delete";

/** Backend guard: does this user have `action` on `moduleKey`, optionally scoped to a specific master-data record? */
export async function userCan(userId: string, moduleKey: string, action: Action, masterDataId?: string): Promise<boolean> {
  const tree = await resolvePermissionTree(userId);
  for (const app of tree) {
    const module = app.modules.find((m) => m.moduleKey === moduleKey);
    if (!module) continue;
    const flag = { read: module.canRead, add: module.canAdd, modify: module.canModify, delete: module.canDelete }[action];
    if (!flag) continue;
    if (module.scopedData.length === 0) return true;
    if (masterDataId && module.scopedData.some((d) => d.masterDataId === masterDataId)) return true;
    if (!masterDataId) return true;
  }
  return false;
}
