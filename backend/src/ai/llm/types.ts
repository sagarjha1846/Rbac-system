export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  // Present on assistant messages that invoked tools.
  toolCalls?: ToolCall[];
  // Present on role: "tool" messages - which call this is the result of.
  toolCallId?: string;
  toolName?: string;
}

export interface ToolDef {
  name: string;
  description: string;
  // JSON Schema for the tool's input.
  parameters: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
}

export interface LLMAdapter {
  chat(messages: ChatMessage[], tools: ToolDef[]): Promise<LLMResponse>;
}
