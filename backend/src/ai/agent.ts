import { randomUUID } from "crypto";
import { createLLMAdapter } from "./llm";
import { ChatMessage } from "./llm/types";
import { toolDefs, executeTool } from "./tools";

const SYSTEM_PROMPT = `You are the RBAC administration assistant for this system. Your job is to
replace manual admin work (creating users, modules, permissions, permission groups, and wiring
them together) with a natural-language conversation.

Domain model, in order of composition:
- An Application has Modules (pages/menus/tabs).
- A Permission grants read/add/modify/delete on one Module, and can optionally be scoped to a
  specific master-data record (e.g. "only this Anchor company") via scope_permission_to_data.
- A PermissionGroup bundles one or more Permissions under a name.
- A User is added to one or more PermissionGroups, and scoped to one or more Applications.

Rules for how you operate:
1. Before creating something, check if it already exists (list_modules, list_permission_groups,
   list_applications, list_users) rather than assuming - re-use existing modules/groups when the
   user's request matches one, unless they clearly want a new one.
2. If the user's request is missing information you need (which permissions per module, whether
   to reuse or create a new permission group, which application, what the group should be named),
   ASK a short, specific clarifying question instead of guessing. Ask one focused question at a
   time, not a long checklist.
2b. If the user gives multiple modules and doesn't specify per-module permissions, ask whether
   every module should get the same permission set or different ones per module.
3. Once you have enough information, execute the full chain of tool calls yourself
   (create_module -> create_permission -> create_permission_group -> add_permission_to_group ->
   create_user -> assign_user_to_group -> assign_user_to_application) without asking the user to
   perform any step manually.
4. After executing, give a short plain-language summary of exactly what was created/changed -
   not a dump of raw IDs.
5. Never invent module/application/group keys that weren't confirmed by the user or found via a
   list_* tool call - slugify sensibly (lowercase, hyphenated) and confirm if ambiguous.`;

interface Session {
  messages: ChatMessage[];
}

const sessions = new Map<string, Session>();

export function createSession(): string {
  const id = randomUUID();
  sessions.set(id, { messages: [{ role: "system", content: SYSTEM_PROMPT }] });
  return id;
}

export interface AgentTurnResult {
  reply: string;
  actionsTaken: { tool: string; args: Record<string, unknown> }[];
}

const MAX_TOOL_ITERATIONS = 8;

export async function runAgentTurn(sessionId: string, userMessage: string): Promise<AgentTurnResult> {
  let session = sessions.get(sessionId);
  if (!session) {
    session = { messages: [{ role: "system", content: SYSTEM_PROMPT }] };
    sessions.set(sessionId, session);
  }

  const llm = createLLMAdapter();
  session.messages.push({ role: "user", content: userMessage });

  const actionsTaken: AgentTurnResult["actionsTaken"] = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await llm.chat(session.messages, toolDefs);

    if (response.toolCalls.length === 0) {
      session.messages.push({ role: "assistant", content: response.content });
      return { reply: response.content, actionsTaken };
    }

    session.messages.push({ role: "assistant", content: response.content, toolCalls: response.toolCalls });

    for (const call of response.toolCalls) {
      actionsTaken.push({ tool: call.name, args: call.arguments });
      let resultText: string;
      try {
        const result = await executeTool(call.name, call.arguments);
        resultText = JSON.stringify(result);
      } catch (err) {
        resultText = JSON.stringify({ error: (err as Error).message });
      }
      session.messages.push({ role: "tool", content: resultText, toolCallId: call.id, toolName: call.name });
    }
  }

  return {
    reply: "I took several actions but hit the step limit before finishing - could you confirm what's left to do?",
    actionsTaken,
  };
}
