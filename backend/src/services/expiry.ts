import { prisma } from "../db";
import { recordAudit } from "./audit";

// resolvePermissionTree already excludes lapsed memberships from every
// permission check, so expired access is never actually usable - this sweep
// just keeps the table from accumulating dead rows and gives each revocation
// its own audit trail entry (source: SYSTEM, since no human or AI drafted it).
export async function revokeExpiredAccess() {
  const expired = await prisma.permissionGroupUserMapping.findMany({
    where: { expiresAt: { lte: new Date() } },
  });

  for (const membership of expired) {
    await prisma.permissionGroupUserMapping.delete({ where: { id: membership.id } });
    await recordAudit({
      source: "SYSTEM",
      action: "access.expire",
      entityType: "PermissionGroupUserMapping",
      entityId: membership.id,
      details: { userId: membership.userId, permissionGroupId: membership.permissionGroupId, expiresAt: membership.expiresAt },
    });
  }

  return { revoked: expired.length };
}
