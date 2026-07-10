import { prisma } from "../db";
import { resolvePermissionTree, Action } from "./permissionTree";

export interface LatentGrant {
  moduleKey: string;
  action: Action;
  risky: boolean;
}

export interface OverPrivilegedUser {
  userId: string;
  email: string;
  latentGrants: LatentGrant[];
}

const ACTIONS: Action[] = ["read", "add", "modify", "delete"];
// modify/delete are flagged as "risky" latent privilege - unused write
// access is a bigger blast radius than unused read access.
const RISKY_ACTIONS = new Set<Action>(["modify", "delete"]);

// Compares what each user is *granted* (via resolvePermissionTree) against
// what they've *actually exercised* (AccessActivityLog, written by the
// requirePermission guard on every successful check). A grant with zero
// matching activity is "latent" - held but never used.
export async function detectOverPrivilegedUsers(): Promise<OverPrivilegedUser[]> {
  const users = await prisma.user.findMany({ where: { isActive: true } });
  const results: OverPrivilegedUser[] = [];

  for (const user of users) {
    const tree = await resolvePermissionTree(user.id);
    const grantedModuleKeys = tree.flatMap((app) => app.modules.map((m) => m.moduleKey));
    if (grantedModuleKeys.length === 0) continue;

    const activity = await prisma.accessActivityLog.findMany({
      where: { userId: user.id, moduleKey: { in: grantedModuleKeys } },
      select: { moduleKey: true, action: true },
    });
    const usedSet = new Set(activity.map((a) => `${a.moduleKey}:${a.action}`));

    const latentGrants: LatentGrant[] = [];
    for (const app of tree) {
      for (const module of app.modules) {
        for (const action of ACTIONS) {
          const granted = { read: module.canRead, add: module.canAdd, modify: module.canModify, delete: module.canDelete }[
            action
          ];
          if (!granted) continue;
          if (usedSet.has(`${module.moduleKey}:${action}`)) continue;
          latentGrants.push({ moduleKey: module.moduleKey, action, risky: RISKY_ACTIONS.has(action) });
        }
      }
    }

    if (latentGrants.length > 0) {
      results.push({ userId: user.id, email: user.email, latentGrants });
    }
  }

  // Users with unused risky (modify/delete) grants surface first.
  return results.sort((a, b) => {
    const riskyA = a.latentGrants.filter((g) => g.risky).length;
    const riskyB = b.latentGrants.filter((g) => g.risky).length;
    return riskyB - riskyA;
  });
}
