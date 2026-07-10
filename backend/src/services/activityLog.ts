import { prisma } from "../db";
import { Action } from "./permissionTree";

// Fire-and-forget: a missed activity record should never fail the request
// it's describing. This is the raw material anomalyDetection.ts uses to
// tell "granted" apart from "actually used".
export function recordActivity(userId: string, moduleKey: string, action: Action) {
  prisma.accessActivityLog
    .create({ data: { userId, moduleKey, action } })
    .catch((err) => console.error("Failed to record access activity", err));
}
