import { ChatMessage, LLMAdapter, LLMResponse, ToolDef } from "../src/ai/llm/types";

// Deterministic stand-in for a real model in tests - returns whatever JSON
// string it's constructed with, so provisioning parsing tests don't depend
// on network access or a live LLM.
export class FakeLLMAdapter implements LLMAdapter {
  constructor(private responseContent: string) {}

  async chat(_messages: ChatMessage[], _tools: ToolDef[]): Promise<LLMResponse> {
    return { content: this.responseContent, toolCalls: [] };
  }
}
