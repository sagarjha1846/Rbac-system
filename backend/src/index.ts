import "dotenv/config";
import { validateEnv } from "./env";

validateEnv();

import { createApp } from "./app";
import { prisma } from "./db";

const port = Number(process.env.PORT) || 4000;
const server = createApp().listen(port, () => {
  console.log(`rbac-system backend listening on http://localhost:${port}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => console.log("HTTP server closed"));
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
