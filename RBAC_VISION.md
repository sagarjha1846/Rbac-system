# RBAC Architecture & AI-Governance Overview

## 1. Schema mapped to hierarchical RBAC

The system predates this document under different names; this section maps
what already exists onto the standard RBAC vocabulary (User / Role /
Permission) plus the new AI-governance layer added in this pass.

| Standard RBAC concept | This system's model | Notes |
|---|---|---|
| User | `User` | first/last name, email, password hash, `role` (free-text business label: Anchor/Vendor/Originator/etc), isActive |
| Role | `PermissionGroup` | a named, reusable bundle of permissions. A user can hold multiple ("multi-role"). `role` on `User` is a *display label*, not the access-control unit - `PermissionGroup` is. |
| Permission | `Permission` | read/add/modify/delete on one `Module`, optionally scoped to a specific `MasterDataStorage` record via `PermissionDataMapping` (row-level scoping - e.g. "read Program, but only for Anchor X") |
| Resource | `Module` (under an `Application`) | a page/menu/tab; `Application` is the top-level system a user is scoped into via `ApplicationUserMapping` |
| Role→Permission mapping | `PermissionGroupMapping` | many-to-many |
| User→Role mapping | `PermissionGroupUserMapping` | many-to-many |
| AI Request log | `ProvisioningRequest` (new) | see §3 |
| Audit log | `AuditLog` (new) | see §3 |
| Activity log | `AccessActivityLog` (new) | see §3 |

This is a hierarchical RBAC model (User → Role → Permission → Resource)
with an additional data-scoping dimension bolted onto Permission, which is
what lets the same "Role" mean different actual data access per
tenant/company (`MasterGroupStorage` catalogs the role categories -
Anchor/Vendor/Co-lender/Originator - and `MasterDataStorage` holds the
concrete records, e.g. one specific anchor company).

**Deliberate naming gap:** we did not rename `PermissionGroup` to `Role` in
this pass. It's already the Role concept in every functional sense; renaming
is a pure refactor with no behavioral upside and would touch every route,
service, and test written so far - not worth the churn for a demo system.

## 2. New AI-governance models

```
ProvisioningRequest       - a natural-language access request + its drafted
                            action + approval lifecycle (PENDING_APPROVAL /
                            EXECUTED / REJECTED)
AuditLog                  - append-only trail of every access-control
                            mutation, tagged MANUAL or AI_DRAFTED
AccessActivityLog         - "this user actually exercised this permission
                            at this time" - the raw signal for over-privilege
                            detection
```

See `backend/prisma/schema.prisma` for the full field list.

## 3. Two AI surfaces, deliberately kept separate

This system now has **two** distinct AI-driven pathways into RBAC, and they
have different trust models on purpose:

1. **The existing admin chat assistant** (`src/ai/agent.ts`, `/chat/*`) - a
   conversational tool-calling loop for a user who *already holds*
   `rbac-admin` permission. It executes tool calls (create module, create
   permission, etc.) directly, turn by turn, because the human driving the
   conversation *is* the approval step - they see and steer every action
   live, and the whole exchange is visible in the chat transcript.
2. **Natural Language Provisioning** (`src/services/provisioning.ts`,
   `/provisioning/*`) - the new feature from this pass. Any authenticated
   user (not just admins) can describe an access need in plain English.
   The LLM drafts a structured action, but **nothing is executed** - it's
   persisted as `PENDING_APPROVAL`. Only a user with `rbac-admin` "modify"
   can approve (which executes it) or reject it. This is the pathway for
   "a manager asks in English, a human with authority signs off before
   anything changes."

Collapsing these into one pathway would either force every admin-chat
action through a manual approval queue (killing the point of the live
admin assistant) or let arbitrary users' NL requests auto-execute (the
opposite of what "enterprise hardening" means here). Keeping them separate
is the simpler design, not a missed unification.

## 4. HITL flow

```
POST /provisioning/draft  {prompt}
  -> LLM drafts a DraftedAction (assign existing user to a group, or
     create a new user + assign) -> stored as PENDING_APPROVAL
  -> AuditLog: source=AI_DRAFTED, action=provisioning.draft

POST /provisioning/:id/approve   (requires rbac-admin modify)
  -> executes the drafted action for real (rbac.assignUserToGroup, etc.)
  -> status -> EXECUTED
  -> AuditLog: source=AI_DRAFTED, action=provisioning.approve

POST /provisioning/:id/reject    (requires rbac-admin modify)
  -> status -> REJECTED, nothing executed
  -> AuditLog: source=AI_DRAFTED, action=provisioning.reject
```

Every mutating route under `/admin/*` also writes an `AuditLog` row with
`source=MANUAL` (see `src/routes/admin.ts`). `AuditLog` has no update or
delete path anywhere in the codebase - it is append-only by construction,
not by convention alone.

## 5. Intelligent role clustering

`src/services/roleClustering.ts` computes a permission signature (sorted
`moduleKey:crud` list) for every `PermissionGroup` and flags groups sharing
an identical signature - the fingerprint of "role explosion": someone
hand-built a near-duplicate group per user instead of reusing one. Exposed
at `GET /admin/role-clusters`. This is deterministic, not model-based - a
clustering *heuristic*, not an AI call - because the input (permission
sets) is already structured data; there's nothing for an LLM to interpret
that a signature comparison doesn't already capture, and a deterministic
function is trivially testable.

## 6. Over-privilege / anomaly detection

`src/auth/middleware.ts`'s `requirePermission` guard now writes an
`AccessActivityLog` row on every successful check - "this user actually
did X". `src/services/anomalyDetection.ts` compares a user's *granted*
module+action combinations (from `resolvePermissionTree`) against what's
actually in their activity log, and flags any grant with zero matching
activity as **latent** - held but never used - with `modify`/`delete`
grants marked `risky` since unused write access is a bigger blast radius
than unused read access. Exposed at `GET /admin/over-privileged-users`.

**Known limitation:** in a fresh system, "never used" and "used, but not
recently" look identical, since there isn't yet enough activity history to
distinguish them. A production version would window this (e.g. "unused in
the last 30 days") once there's enough log volume to make that meaningful;
the demo's signal is "unused since granted."

## 7. What's still out of scope

- No automatic expiry enforcement for `expiresAt` on a provisioning
  request - it's captured as metadata but nothing revokes access when it
  passes. Would need a scheduled job; deliberately deferred to keep this
  pass bounded.
- No pagination on audit/provisioning listing endpoints.
- Role clustering and over-privilege detection are pull-based (call the
  endpoint) rather than push-based (scheduled scan + alert) - fine for an
  admin dashboard, not for real-time alerting.
