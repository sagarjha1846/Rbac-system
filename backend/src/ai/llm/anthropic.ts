import Anthropic from "@anthropic-ai/sdk";
import { ChatMessage, LLMAdapter, LLMResponse, ToolDef } from "./types";

// Only used for local/sandbox demoing of this project. Real deployments
// should set LLM_PROVIDER=openai-compatible and point at an internal model.
export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async chat(messages: ChatMessage[], tools: ToolDef[]): Promise<LLMResponse> {
    const systemMessage = messages.find((m) => m.role === "system")?.content;
    const conversation = messages.filter((m) => m.role !== "system");

    const anthropicMessages: Anthropic.MessageParam[] = conversation.map((m) => {
      if (m.role === "assistant" && m.toolCalls?.length) {
        return {
          role: "assistant",
          content: [
            ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
            ...m.toolCalls.map((tc) => ({
              type: "tool_use" as const,
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            })),
          ],
        };
      }
      if (m.role === "tool") {
        return {
          role: "user",
          content: [{ type: "tool_result" as const, tool_use_id: m.toolCallId!, content: m.content }],
        };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: systemMessage,
      messages: anthropicMessages,
      tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters as any })),
    });

    let content = "";
    const toolCalls: LLMResponse["toolCalls"] = [];
    for (const block of response.content) {
      if (block.type === "text") content += block.text;
      if (block.type === "tool_use") {
        toolCalls.push({ id: block.id, name: block.name, arguments: block.input as Record<string, unknown> });
      }
    }
    return { content, toolCalls };
  }
}
