import { Router } from "express";
import { createSession, runAgentTurn } from "../ai/agent";
import { authenticate, requirePermission } from "../auth/middleware";

export const chatRouter = Router();
// The chat agent can create users/permissions/groups, so it's gated behind
// the same "rbac-admin" module permission as the plain CRUD routes.
chatRouter.use(authenticate, requirePermission("rbac-admin", "add"));

chatRouter.post("/session", (_req, res) => {
  res.json({ sessionId: createSession() });
});

chatRouter.post("/message", async (req, res) => {
  const { sessionId, message } = req.body ?? {};
  if (!sessionId || !message) return res.status(400).json({ error: "sessionId and message are required" });
  try {
    const result = await runAgentTurn(sessionId, message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
