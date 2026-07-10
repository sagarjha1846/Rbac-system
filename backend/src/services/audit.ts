import { Prisma } from "@prisma/client";
import { prisma } from "../db";

export type AuditSource = "MANUAL" | "AI_DRAFTED";

export interface AuditEntry {
  actorId?: string | null;
  source: AuditSource;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Prisma.InputJsonValue;
}

// The only function in this codebase allowed to write to AuditLog. There is
// deliberately no updateAudit/deleteAudit - the log is append-only, and no
// route ever exposes editing or deleting an entry.
export async function recordAudit(entry: AuditEntry) {
  return prisma.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      source: entry.source,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      details: entry.details,
    },
  });
}

export async function listAuditLogs(limit = 100) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
    include: { actor: { select: { id: true, email: true } } },
  });
}
