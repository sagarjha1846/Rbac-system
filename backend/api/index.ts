// Vercel serverless entry point. Wraps the same Express app used for local
// dev/tests (src/app.ts) so there's exactly one place that defines routes.
import "dotenv/config";
import { validateEnv } from "../src/env";
import { createApp } from "../src/app";

validateEnv();

export default createApp();
