import { ToolDef } from "./llm/types";
import * as rbac from "../services/rbac";
import { resolvePermissionTree } from "../services/permissionTree";

export const toolDefs: ToolDef[] = [
  {
    name: "list_applications",
    description: "List all applications registered in the system.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_modules",
    description: "List modules, optionally filtered to one application.",
    parameters: {
      type: "object",
      properties: { applicationKey: { type: "string", description: "Optional application key to filter by" } },
    },
  },
  {
    name: "create_application",
    description: "Create a new application (top-level system a user can be scoped to).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        key: { type: "string", description: "Unique slug, e.g. 'supply-chain-finance'" },
        description: { type: "string" },
      },
      required: ["name", "key"],
    },
  },
  {
    name: "create_module",
    description: "Create a module (a page/menu/tab) inside an application. Idempotent by (applicationKey, key).",
    parameters: {
      type: "object",
      properties: {
        applicationKey: { type: "string" },
        name: { type: "string" },
        key: { type: "string" },
        description: { type: "string" },
        moduleType: { type: "string", enum: ["BASIC", "MENU", "TAB"] },
        moduleRoute: { type: "string" },
        order: { type: "number" },
      },
      required: ["applicationKey", "name", "key"],
    },
  },
  {
    name: "create_permission",
    description: "Create a CRUD permission grant for a module. Returns a permissionId to attach to a group.",
    parameters: {
      type: "object",
      properties: {
        applicationKey: { type: "string" },
        moduleKey: { type: "string" },
        canRead: { type: "boolean" },
        canAdd: { type: "boolean" },
        canModify: { type: "boolean" },
        canDelete: { type: "boolean" },
      },
      required: ["applicationKey", "moduleKey"],
    },
  },
  {
    name: "create_permission_group",
    description: "Create a permission group (a named bundle of permissions, e.g. 'Vendor Manager'). Idempotent by key.",
    parameters: {
      type: "object",
      properties: { name: { type: "string" }, key: { type: "string" }, description: { type: "string" } },
      required: ["name", "key"],
    },
  },
  {
    name: "add_permission_to_group",
    description: "Attach a previously-created permission (by id) to a permission group (by key).",
    parameters: {
      type: "object",
      properties: { permissionId: { type: "string" }, permissionGroupKey: { type: "string" } },
      required: ["permissionId", "permissionGroupKey"],
    },
  },
  {
    name: "list_permission_groups",
    description: "List all permission groups and the permissions/modules attached to each.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "create_user",
    description: "Create a new user account.",
    parameters: {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        password: { type: "string", description: "Temporary password; user should change on first login" },
        role: { type: "string", description: "Business role label, e.g. Anchor, Vendor, Co-lender, Originator" },
      },
      required: ["firstName", "lastName", "email", "password", "role"],
    },
  },
  {
    name: "list_users",
    description: "List all users in the system.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "assign_user_to_application",
    description: "Scope a user (by email) to an application (by key), restricting them to that application's modules.",
    parameters: {
      type: "object",
      properties: { email: { type: "string" }, applicationKey: { type: "string" } },
      required: ["email", "applicationKey"],
    },
  },
  {
    name: "assign_user_to_group",
    description: "Add a user (by email) to a permission group (by key). A user can belong to multiple groups.",
    parameters: {
      type: "object",
      properties: { email: { type: "string" }, permissionGroupKey: { type: "string" } },
      required: ["email", "permissionGroupKey"],
    },
  },
  {
    name: "get_permission_tree",
    description: "Fetch the fully-resolved permission tree for a user (by email) - what they can actually see/do.",
    parameters: { type: "object", properties: { email: { type: "string" } }, required: ["email"] },
  },
  {
    name: "create_master_group",
    description: "Create a master group - a catalog entry for a role/category used in data scoping (e.g. 'Anchor').",
    parameters: {
      type: "object",
      properties: { name: { type: "string" }, key: { type: "string" }, description: { type: "string" } },
      required: ["name", "key"],
    },
  },
  {
    name: "create_master_data",
    description: "Create a concrete data record under a master group (e.g. a specific anchor company) that a permission can be scoped to.",
    parameters: {
      type: "object",
      properties: {
        masterGroupKey: { type: "string" },
        name: { type: "string" },
        code: { type: "string", description: "e.g. PAN or external ID" },
        description: { type: "string" },
      },
      required: ["masterGroupKey", "name"],
    },
  },
  {
    name: "scope_permission_to_data",
    description: "Restrict a permission (by id) to only apply to one specific master-data record (by id), instead of the whole module.",
    parameters: {
      type: "object",
      properties: { permissionId: { type: "string" }, masterDataId: { type: "string" } },
      required: ["permissionId", "masterDataId"],
    },
  },
];

export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "list_applications":
      return rbac.listApplications();
    case "list_modules":
      return rbac.listModules(args.applicationKey as string | undefined);
    case "create_application":
      return rbac.createApplication(args as any);
    case "create_module":
      return rbac.createModule(args as any);
    case "create_permission":
      return rbac.createPermission(args as any);
    case "create_permission_group":
      return rbac.createPermissionGroup(args as any);
    case "add_permission_to_group":
      return rbac.addPermissionToGroup(args as any);
    case "list_permission_groups":
      return rbac.listPermissionGroups();
    case "create_user":
      return rbac.createUser(args as any);
    case "list_users":
      return rbac.listUsers();
    case "assign_user_to_application": {
      const user = await requireUserByEmail(args.email as string);
      return rbac.assignUserToApplication({ userId: user.id, applicationKey: args.applicationKey as string });
    }
    case "assign_user_to_group": {
      const user = await requireUserByEmail(args.email as string);
      return rbac.assignUserToGroup({ userId: user.id, permissionGroupKey: args.permissionGroupKey as string });
    }
    case "get_permission_tree": {
      const user = await requireUserByEmail(args.email as string);
      return resolvePermissionTree(user.id);
    }
    case "create_master_group":
      return rbac.createMasterGroup(args as any);
    case "create_master_data":
      return rbac.createMasterData(args as any);
    case "scope_permission_to_data":
      return rbac.scopePermissionToData(args as any);
    default:
      throw new Error(`Unknown tool '${name}'`);
  }
}

async function requireUserByEmail(email: string) {
  const user = await rbac.findUserByEmail(email);
  if (!user) throw new Error(`No user found with email '${email}'`);
  return user;
}
