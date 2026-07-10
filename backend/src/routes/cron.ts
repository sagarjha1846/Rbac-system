import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { revokeExpiredAccess } from "../services/expiry";

export const cronRouter = Router();

// Vercel Cron (see backend/vercel.json) calls this on a schedule with
// `Authorization: Bearer $CRON_SECRET` - see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
// Not gated behind the normal JWT auth since there's no logged-in user
// making this call.
cronRouter.get(
  "/expire-access",
  asyncHandler(async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const header = req.headers.authorization;
      if (header !== `Bearer ${secret}`) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }
    res.json(await revokeExpiredAccess());
  })
);
