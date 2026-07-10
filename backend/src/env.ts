// Fails fast at boot instead of limping along with insecure defaults or a
// missing DB connection - much easier to diagnose on a deploy host than a
// vague runtime error three requests in.
export function validateEnv() {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");

  if (process.env.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET) missing.push("JWT_SECRET");
    if (!process.env.FRONTEND_ORIGIN) missing.push("FRONTEND_ORIGIN");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}

export const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret";
