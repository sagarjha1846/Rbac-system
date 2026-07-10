import { NextFunction, Request, Response } from "express";
import { verifyToken } from "./jwt";
import { userCan, Action } from "../services/permissionTree";

export interface AuthedRequest extends Request {
  userId?: string;
}

export function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Route guard: 403s unless the authenticated user has `action` on `moduleKey`. */
export function requirePermission(moduleKey: string, action: Action) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: "Unauthenticated" });
    const masterDataId = (req.query.masterDataId as string) || undefined;
    const allowed = await userCan(req.userId, moduleKey, action, masterDataId);
    if (!allowed) return res.status(403).json({ error: `Not permitted: ${action} on ${moduleKey}` });
    next();
  };
}
