import { Router } from "express";
import { authenticate } from "../auth/middleware";
import { requirePermission } from "../auth/middleware";
import * as rbac from "../services/rbac";
import { resolvePermissionTree } from "../services/permissionTree";

// All routes here are the plain CRUD surface for the RBAC admin console -
// the AI chat tools (see src/ai/tools.ts) call the same rbac service
// functions directly. Gated behind the "rbac-admin" module so only users
// in a group with admin permissions can manage the system.
export const adminRouter = Router();
adminRouter.use(authenticate);

adminRouter.get("/applications", requirePermission("rbac-admin", "read"), async (_req, res) => {
  res.json(await rbac.listApplications());
});

adminRouter.post("/applications", requirePermission("rbac-admin", "add"), async (req, res) => {
  res.json(await rbac.createApplication(req.body));
});

adminRouter.get("/modules", requirePermission("rbac-admin", "read"), async (req, res) => {
  res.json(await rbac.listModules(req.query.applicationKey as string | undefined));
});

adminRouter.post("/modules", requirePermission("rbac-admin", "add"), async (req, res) => {
  res.json(await rbac.createModule(req.body));
});

adminRouter.post("/permissions", requirePermission("rbac-admin", "add"), async (req, res) => {
  res.json(await rbac.createPermission(req.body));
});

adminRouter.get("/permission-groups", requirePermission("rbac-admin", "read"), async (_req, res) => {
  res.json(await rbac.listPermissionGroups());
});

adminRouter.post("/permission-groups", requirePermission("rbac-admin", "add"), async (req, res) => {
  res.json(await rbac.createPermissionGroup(req.body));
});

adminRouter.post("/permission-groups/:key/permissions", requirePermission("rbac-admin", "modify"), async (req, res) => {
  res.json(await rbac.addPermissionToGroup({ permissionId: req.body.permissionId, permissionGroupKey: req.params.key }));
});

adminRouter.get("/users", requirePermission("rbac-admin", "read"), async (_req, res) => {
  res.json(await rbac.listUsers());
});

adminRouter.post("/users", requirePermission("rbac-admin", "add"), async (req, res) => {
  res.json(await rbac.createUser(req.body));
});

adminRouter.post("/users/:id/applications", requirePermission("rbac-admin", "modify"), async (req, res) => {
  res.json(await rbac.assignUserToApplication({ userId: req.params.id, applicationKey: req.body.applicationKey }));
});

adminRouter.post("/users/:id/groups", requirePermission("rbac-admin", "modify"), async (req, res) => {
  res.json(await rbac.assignUserToGroup({ userId: req.params.id, permissionGroupKey: req.body.permissionGroupKey }));
});

adminRouter.get("/users/:id/permission-tree", requirePermission("rbac-admin", "read"), async (req, res) => {
  res.json(await resolvePermissionTree(req.params.id));
});

adminRouter.post("/master-groups", requirePermission("rbac-admin", "add"), async (req, res) => {
  res.json(await rbac.createMasterGroup(req.body));
});

adminRouter.post("/master-data", requirePermission("rbac-admin", "add"), async (req, res) => {
  res.json(await rbac.createMasterData(req.body));
});

adminRouter.post("/permissions/:id/scope", requirePermission("rbac-admin", "modify"), async (req, res) => {
  res.json(await rbac.scopePermissionToData({ permissionId: req.params.id, masterDataId: req.body.masterDataId }));
});
