import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { chatRouter } from "./routes/chat";
import { provisioningRouter } from "./routes/provisioning";
import { cronRouter } from "./routes/cron";

export function createApp() {
  const app = express();

  const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim());
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json());
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use("/admin", adminRouter);
  app.use("/chat", chatRouter);
  app.use("/provisioning", provisioningRouter);
  app.use("/cron", cronRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Centralized error handler - any route/middleware that throws or calls
  // next(err) ends up here instead of Express's default HTML error page.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  });

  return app;
}
