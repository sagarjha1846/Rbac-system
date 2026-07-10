import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { chatRouter } from "./routes/chat";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use("/admin", adminRouter);
  app.use("/chat", chatRouter);

  return app;
}
