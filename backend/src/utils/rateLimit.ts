import rateLimit from "express-rate-limit";

// Brute-force guard: a handful of wrong passwords is normal, hundreds isn't.
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
});

// LLM calls cost money and can be abused for spam/DoS - cap both AI entry
// points independent of the per-user permission check.
export const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests this hour, please try again later" },
});
