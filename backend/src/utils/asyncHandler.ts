import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Express 4 does not catch rejected promises from async handlers - without
// this, a thrown error in an async route just hangs the request instead of
// reaching the centralized error handler in app.ts.
export function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid request body", details: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
}
