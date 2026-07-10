import { Router } from "express";
import { createSession, runAgentTurn } from "../ai/agent";
import { authenticate, requirePermission } from "../auth/middleware";
import { asyncHandler, validateBody } from "../utils/asyncHandler";
import { chatMessageSchema } from "./validation";
import { aiRateLimit } from "../utils/rateLimit";

export const chatRouter = Router();
// The chat agent can create users/permissions/groups, so it's gated behind
// the same "rbac-admin" module permission as the plain CRUD routes.
chatRouter.use(authenticate, requirePermission("rbac-admin", "add"));

chatRouter.post(
  "/session",
  asyncHandler(async (_req, res) => {
    res.json({ sessionId: createSession() });
  })
);

chatRouter.post(
  "/message",
  aiRateLimit,
  validateBody(chatMessageSchema),
  asyncHandler(async (req, res) => {
    const { sessionId, message } = req.body;
    const result = await runAgentTurn(sessionId, message);
    res.json(result);
  })
);
