import { z } from "zod";

export const createApplicationSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  description: z.string().optional(),
});

export const createModuleSchema = z.object({
  applicationKey: z.string().min(1),
  name: z.string().min(1),
  key: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int().optional(),
  moduleType: z.enum(["BASIC", "MENU", "TAB"]).optional(),
  moduleRoute: z.string().optional(),
});

export const createPermissionSchema = z.object({
  applicationKey: z.string().min(1),
  moduleKey: z.string().min(1),
  canRead: z.boolean().optional(),
  canAdd: z.boolean().optional(),
  canModify: z.boolean().optional(),
  canDelete: z.boolean().optional(),
});

export const createPermissionGroupSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  description: z.string().optional(),
  type: z.string().optional(),
});

export const addPermissionToGroupSchema = z.object({
  permissionId: z.string().min(1),
});

export const createUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.string().min(1),
  isActive: z.boolean().optional(),
});

export const assignApplicationSchema = z.object({
  applicationKey: z.string().min(1),
});

export const assignGroupSchema = z.object({
  permissionGroupKey: z.string().min(1),
});

export const createMasterGroupSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  description: z.string().optional(),
});

export const createMasterDataSchema = z.object({
  masterGroupKey: z.string().min(1),
  name: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
});

export const scopePermissionSchema = z.object({
  masterDataId: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const chatMessageSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
});

export const draftProvisioningSchema = z.object({
  prompt: z.string().min(1),
});

export const rejectProvisioningSchema = z.object({
  reason: z.string().optional(),
});
