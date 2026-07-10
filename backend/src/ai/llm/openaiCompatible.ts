import { ChatMessage, LLMAdapter, LLMResponse, ToolDef } from "./types";

// Talks to any server exposing an OpenAI-compatible /v1/chat/completions
// endpoint with function-calling support - vLLM, Ollama, TGI, LocalAI, etc.
// Point OPENAI_COMPATIBLE_BASE_URL at your internal deployment; nothing
// here ever calls out to a third party.
export class OpenAICompatibleAdapter implements LLMAdapter {
  constructor(private baseUrl: string, private apiKey: string, private model: string) {}

  async chat(messages: ChatMessage[], tools: ToolDef[]): Promise<LLMResponse> {
    const body = {
      model: this.model,
      messages: messages.map((m) => {
        if (m.role === "assistant" && m.toolCalls?.length) {
          return {
            role: "assistant",
            content: m.content || null,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function",
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            })),
          };
        }
        if (m.role === "tool") {
          return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
        }
        return { role: m.role, content: m.content };
      }),
      tools: tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: "auto",
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`LLM endpoint returned ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as any;
    const message = json.choices[0].message;
    const toolCalls: LLMResponse["toolCalls"] = (message.tool_calls || []).map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeParseJson(tc.function.arguments),
    }));

    return { content: message.content || "", toolCalls };
  }
}

function safeParseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
