import { Router } from "express";
import { authenticate, requirePermission, AuthedRequest } from "../auth/middleware";
import * as rbac from "../services/rbac";
import { resolvePermissionTree } from "../services/permissionTree";
import { recordAudit, listAuditLogs } from "../services/audit";
import { suggestRoleClusters } from "../services/roleClustering";
import { detectOverPrivilegedUsers } from "../services/anomalyDetection";
import { asyncHandler, validateBody } from "../utils/asyncHandler";
import * as v from "./validation";

// All routes here are the plain CRUD surface for the RBAC admin console -
// the AI chat tools (see src/ai/tools.ts) call the same rbac service
// functions directly. Gated behind the "rbac-admin" module so only users
// in a group with admin permissions can manage the system. Every mutation
// here is logged to AuditLog with source MANUAL - see src/services/audit.ts.
export const adminRouter = Router();
adminRouter.use(authenticate);

adminRouter.get(
  "/applications",
  requirePermission("rbac-admin", "read"),
  asyncHandler(async (_req, res) => {
    res.json(await rbac.listApplications());
  })
);

adminRouter.post(
  "/applications",
  requirePermission("rbac-admin", "add"),
  validateBody(v.createApplicationSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const application = await rbac.createApplication(req.body);
    await recordAudit({
      actorId: req.userId,
      source: "MANUAL",
      action: "application.create",
      entityType: "Application",
      entityId: application.id,
      details: req.body,
    });
    res.json(application);
  })
);

adminRouter.get(
  "/modules",
  requirePermission("rbac-admin", "read"),
  asyncHandler(async (req, res) => {
    res.json(await rbac.listModules(req.query.applicationKey as string | undefined));
  })
);

adminRouter.post(
  "/modules",
  requirePermission("rbac-admin", "add"),
  validateBody(v.createModuleSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const module = await rbac.createModule(req.body);
    await recordAudit({
      actorId: req.userId,
      source: "MANUAL",
      action: "module.create",
      entityType: "Module",
      entityId: module.id,
      details: req.body,
    });
    res.json(module);
  })
);

adminRouter.post(
  "/permissions",
  requirePermission("rbac-admin", "add"),
  validateBody(v.createPermissionSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const permission = await rbac.createPermission(req.body);
    await recordAudit({
      actorId: req.userId,
      source: "MANUAL",
      action: "permission.create",
      entityType: "Permission",
      entityId: permission.id,
      details: req.body,
    });
    res.json(permission);
  })
);

adminRouter.get(
  "/permission-groups",
  requirePermission("rbac-admin", "read"),
  asyncHandler(async (_req, res) => {
    res.json(await rbac.listPermissionGroups());
  })
);

adminRouter.post(
  "/permission-groups",
  requirePermission("rbac-admin", "add"),
  validateBody(v.createPermissionGroupSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const group = await rbac.createPermissionGroup(req.body);
    await recordAudit({
      actorId: req.userId,
      source: "MANUAL",
      action: "permissionGroup.create",
      entityType: "PermissionGroup",
      entityId: group.id,
      details: req.body,
    });
    res.json(group);
  })
);

adminRouter.post(
  "/permission-groups/:key/permissions",
  requirePermission("rbac-admin", "modify"),
  validateBody(v.addPermissionToGroupSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const mapping = await rbac.addPermissionToGroup({
      permissionId: req.body.permissionId,
      permissionGroupKey: req.params.key,
    });
    await recordAudit({
      actorId: req.userId,
      source: "MANUAL",
      action: "permissionGroup.addPermission",
      entityType: "PermissionGroup",
      entityId: mapping.permissionGroupId,
      details: { permissionId: req.body.permissionId, permissionGroupKey: req.params.key },
    });
    res.json(mapping);
  })
);

adminRouter.get(
  "/users",
  requirePermission("rbac-admin", "read"),
  asyncHandler(async (_req, res) => {
    res.json(await rbac.listUsers());
  })
);

adminRouter.post(
  "/users",
  requirePermission("rbac-admin", "add"),
  validateBody(v.createUserSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await rbac.createUser(req.body);
    await recordAudit({
      actorId: req.userId,
      source: "MANUAL",
      action: "user.create",
      entityType: "User",
      entityId: user.id,
      details: { email: user.email, role: user.role },
    });
    res.json(user);
  })
);

adminRouter.post(
  "/users/:id/applications",
  requirePermission("rbac-admin", "modify"),
  validateBody(v.assignApplicationSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const mapping = await rbac.assignUserToApplication({
      userId: req.params.id,
      applicationKey: req.body.applicationKey,
    });
    await recordAudit({
      actorId: req.userId,
      source: "MANUAL",
      action: "user.assignApplication",
      entityType: "User",
      entityId: req.params.id,
      details: { applicationKey: req.body.applicationKey },
    });
    res.json(mapping);
  })
);

adminRouter.post(
  "/users/:id/groups",
  requirePermission("rbac-admin", "modify"),
  validateBody(v.assignGroupSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const mapping = await rbac.assignUserToGroup({
      userId: req.params.id,
      permissionGroupKey: req.body.permissionGroupKey,
    });
    await recordAudit({
      actorId: req.userId,
      source: "MANUAL",
      action: "user.assignGroup",
      entityType: "User",
      entityId: req.params.id,
      details: { permissionGroupKey: req.body.permissionGroupKey },
    });
    res.json(mapping);
  })
);

adminRouter.get(
  "/users/:id/permission-tree",
  requirePermission("rbac-admin", "read"),
  asyncHandler(async (req, res) => {
    res.json(await resolvePermissionTree(req.params.id));
  })
);

adminRouter.post(
  "/master-groups",
  requirePermission("rbac-admin", "add"),
  validateBody(v.createMasterGroupSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const group = await rbac.createMasterGroup(req.body);
    await recordAudit({
      actorId: req.userId,
      source: "MANUAL",
      action: "masterGroup.create",
      entityType: "MasterGroupStorage",
      entityId: group.id,
      details: req.body,
    });
    res.json(group);
  })
);

adminRouter.post(
  "/master-data",
  requirePermission("rbac-admin", "add"),
  validateBody(v.createMasterDataSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = await rbac.createMasterData(req.body);
    await recordAudit({
      actorId: req.userId,
      source: "MANUAL",
      action: "masterData.create",
      entityType: "MasterDataStorage",
      entityId: data.id,
      details: req.body,
    });
    res.json(data);
  })
);

adminRouter.post(
  "/permissions/:id/scope",
  requirePermission("rbac-admin", "modify"),
  validateBody(v.scopePermissionSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const scope = await rbac.scopePermissionToData({
      permissionId: req.params.id,
      masterDataId: req.body.masterDataId,
    });
    await recordAudit({
      actorId: req.userId,
      source: "MANUAL",
      action: "permission.scopeToData",
      entityType: "Permission",
      entityId: req.params.id,
      details: { masterDataId: req.body.masterDataId },
    });
    res.json(scope);
  })
);

adminRouter.get(
  "/audit-logs",
  requirePermission("rbac-admin", "read"),
  asyncHandler(async (req, res) => {
    res.json(await listAuditLogs(req.query.limit ? Number(req.query.limit) : undefined));
  })
);

adminRouter.get(
  "/role-clusters",
  requirePermission("rbac-admin", "read"),
  asyncHandler(async (_req, res) => {
    res.json(await suggestRoleClusters());
  })
);

adminRouter.get(
  "/over-privileged-users",
  requirePermission("rbac-admin", "read"),
  asyncHandler(async (_req, res) => {
    res.json(await detectOverPrivilegedUsers());
  })
);
