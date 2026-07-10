import { Router } from "express";
import { authenticate, requirePermission, AuthedRequest } from "../auth/middleware";
import { asyncHandler, validateBody } from "../utils/asyncHandler";
import { draftProvisioningSchema, rejectProvisioningSchema } from "./validation";
import {
  draftProvisioningRequest,
  listProvisioningRequests,
  countProvisioningRequests,
  approveProvisioningRequest,
  rejectProvisioningRequest,
} from "../services/provisioning";
import { createLLMAdapter } from "../ai/llm";
import { aiRateLimit } from "../utils/rateLimit";
import { parsePagination, paginatedResponse } from "../utils/pagination";

// Natural-language access provisioning: any authenticated user can describe
// what they need in plain English, but nothing is executed until an
// rbac-admin approves it (see approveProvisioningRequest) - see
// RBAC_VISION.md for why this is separate from the free-form chat assistant.
export const provisioningRouter = Router();
provisioningRouter.use(authenticate);

provisioningRouter.post(
  "/draft",
  aiRateLimit,
  validateBody(draftProvisioningSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const llm = createLLMAdapter();
    const request = await draftProvisioningRequest(req.body.prompt, req.userId, llm);
    res.status(201).json(request);
  })
);

provisioningRouter.get(
  "/",
  requirePermission("rbac-admin", "read"),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const [data, total] = await Promise.all([
      listProvisioningRequests(pagination.skip, pagination.take),
      countProvisioningRequests(),
    ]);
    res.json(paginatedResponse(data, total, pagination));
  })
);

provisioningRouter.post(
  "/:id/approve",
  requirePermission("rbac-admin", "modify"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const updated = await approveProvisioningRequest(req.params.id, req.userId!);
    res.json(updated);
  })
);

provisioningRouter.post(
  "/:id/reject",
  requirePermission("rbac-admin", "modify"),
  validateBody(rejectProvisioningSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const updated = await rejectProvisioningRequest(req.params.id, req.userId!, req.body.reason);
    res.json(updated);
  })
);
