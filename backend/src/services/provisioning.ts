import { prisma } from "../db";
import { LLMAdapter } from "../ai/llm/types";
import * as rbac from "./rbac";
import { recordAudit } from "./audit";

export type DraftedAction =
  | {
      type: "assign_existing_user_to_group";
      targetEmail: string;
      permissionGroupKey: string;
      applicationKey?: string;
      expiresAt?: string;
      notes?: string;
    }
  | {
      type: "create_user_and_assign";
      firstName: string;
      lastName: string;
      targetEmail: string;
      role: string;
      permissionGroupKey: string;
      applicationKey?: string;
      expiresAt?: string;
      notes?: string;
    };

const PARSE_SYSTEM_PROMPT = `You convert a plain-English access request into a single JSON object describing
the precise RBAC action to take. Respond with ONLY the JSON object, no prose, no markdown fences.

Schema (pick exactly one "type"):
{"type":"assign_existing_user_to_group","targetEmail":string,"permissionGroupKey":string,"applicationKey"?:string,"expiresAt"?:string (ISO date, only if the request mentions a temporary/time-boxed grant),"notes"?:string}
or
{"type":"create_user_and_assign","firstName":string,"lastName":string,"targetEmail":string,"role":string,"permissionGroupKey":string,"applicationKey"?:string,"expiresAt"?:string,"notes"?:string}

Use "create_user_and_assign" only if the request clearly describes someone who doesn't have an account yet
(e.g. "new intern", "new hire") and no email is given - invent a plausible targetEmail as firstname.lastname@company.example.
Use "assign_existing_user_to_group" whenever an email is given. permissionGroupKey should be a lowercase-hyphenated
slug guessed from the request (e.g. "analytics-read-only" for "read-only access to analytics").`;

export async function parseProvisioningPrompt(prompt: string, llm: LLMAdapter): Promise<DraftedAction> {
  const response = await llm.chat(
    [
      { role: "system", content: PARSE_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    []
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.content.trim());
  } catch {
    throw new Error(`LLM did not return valid JSON for provisioning prompt: ${response.content}`);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("type" in parsed) ||
    !("targetEmail" in parsed) ||
    !("permissionGroupKey" in parsed)
  ) {
    throw new Error(`LLM response is missing required drafted-action fields: ${response.content}`);
  }

  return parsed as DraftedAction;
}

export async function draftProvisioningRequest(prompt: string, requestedById: string | undefined, llm: LLMAdapter) {
  const draftedAction = await parseProvisioningPrompt(prompt, llm);

  const request = await prisma.provisioningRequest.create({
    data: {
      prompt,
      draftedAction: draftedAction as object,
      requestedById,
    },
  });

  await recordAudit({
    actorId: requestedById,
    source: "AI_DRAFTED",
    action: "provisioning.draft",
    entityType: "ProvisioningRequest",
    entityId: request.id,
    details: { prompt, draftedAction },
  });

  return request;
}

export async function listProvisioningRequests(skip?: number, take?: number) {
  return prisma.provisioningRequest.findMany({ orderBy: { createdAt: "desc" }, skip, take });
}

export async function countProvisioningRequests() {
  return prisma.provisioningRequest.count();
}

async function executeDraftedAction(action: DraftedAction) {
  const expiresAt = action.expiresAt ? new Date(action.expiresAt) : undefined;

  if (action.type === "create_user_and_assign") {
    const user = await rbac.createUser({
      firstName: action.firstName,
      lastName: action.lastName,
      email: action.targetEmail,
      password: cryptoRandomPassword(),
      role: action.role,
    });
    if (action.applicationKey) {
      await rbac.assignUserToApplication({ userId: user.id, applicationKey: action.applicationKey });
    }
    await rbac.assignUserToGroup({ userId: user.id, permissionGroupKey: action.permissionGroupKey, expiresAt });
    return { userId: user.id, email: user.email, expiresAt };
  }

  const user = await rbac.findUserByEmail(action.targetEmail);
  if (!user) throw new Error(`No existing user found with email '${action.targetEmail}'`);
  if (action.applicationKey) {
    await rbac.assignUserToApplication({ userId: user.id, applicationKey: action.applicationKey });
  }
  await rbac.assignUserToGroup({ userId: user.id, permissionGroupKey: action.permissionGroupKey, expiresAt });
  return { userId: user.id, email: user.email, expiresAt };
}

function cryptoRandomPassword() {
  return `Temp-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export async function approveProvisioningRequest(requestId: string, approverId: string) {
  const request = await prisma.provisioningRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.status !== "PENDING_APPROVAL") {
    throw new Error(`Provisioning request ${requestId} is not pending approval (status: ${request.status})`);
  }

  const draftedAction = request.draftedAction as unknown as DraftedAction;
  const result = await executeDraftedAction(draftedAction);

  const updated = await prisma.provisioningRequest.update({
    where: { id: requestId },
    data: { status: "EXECUTED", reviewedById: approverId, reviewedAt: new Date() },
  });

  await recordAudit({
    actorId: approverId,
    source: "AI_DRAFTED",
    action: "provisioning.approve",
    entityType: "ProvisioningRequest",
    entityId: requestId,
    details: { draftedAction, result },
  });

  return updated;
}

export async function rejectProvisioningRequest(requestId: string, approverId: string, reason?: string) {
  const request = await prisma.provisioningRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.status !== "PENDING_APPROVAL") {
    throw new Error(`Provisioning request ${requestId} is not pending approval (status: ${request.status})`);
  }

  const updated = await prisma.provisioningRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", reviewedById: approverId, reviewedAt: new Date(), rejectionReason: reason },
  });

  await recordAudit({
    actorId: approverId,
    source: "AI_DRAFTED",
    action: "provisioning.reject",
    entityType: "ProvisioningRequest",
    entityId: requestId,
    details: { reason },
  });

  return updated;
}
