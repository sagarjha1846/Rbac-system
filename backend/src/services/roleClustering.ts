import { prisma } from "../db";

export interface RoleClusterSuggestion {
  signature: string;
  groupKeys: string[];
  groupNames: string[];
  totalUsers: number;
  suggestedName: string;
}

// Deterministic "role explosion" detector: groups that grant the exact same
// set of module+CRUD permissions but were created as separate
// PermissionGroups (usually because each was hand-built for one user) are
// prime candidates to merge into a single shared role.
export async function suggestRoleClusters(): Promise<RoleClusterSuggestion[]> {
  const groups = await prisma.permissionGroup.findMany({
    include: {
      permissions: { include: { permission: { include: { module: true } } } },
      users: true,
    },
  });

  const bySignature = new Map<string, typeof groups>();
  for (const group of groups) {
    const signature = group.permissions
      .map((pg) => {
        const p = pg.permission;
        return `${p.module.key}:${p.canRead ? "r" : ""}${p.canAdd ? "a" : ""}${p.canModify ? "m" : ""}${p.canDelete ? "d" : ""}`;
      })
      .sort()
      .join("|");

    if (!signature) continue; // skip empty/no-permission groups, nothing to cluster
    const bucket = bySignature.get(signature) ?? [];
    bucket.push(group);
    bySignature.set(signature, bucket);
  }

  const suggestions: RoleClusterSuggestion[] = [];
  for (const [signature, bucket] of bySignature) {
    if (bucket.length < 2) continue; // no duplication, nothing to suggest
    suggestions.push({
      signature,
      groupKeys: bucket.map((g) => g.key),
      groupNames: bucket.map((g) => g.name),
      totalUsers: bucket.reduce((sum, g) => sum + g.users.length, 0),
      suggestedName: bucket.map((g) => g.name).sort()[0] + " (merged)",
    });
  }

  return suggestions.sort((a, b) => b.totalUsers - a.totalUsers);
}
