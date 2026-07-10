import { LLMAdapter } from "./types";
import { AnthropicAdapter } from "./anthropic";
import { OpenAICompatibleAdapter } from "./openaiCompatible";

export function createLLMAdapter(): LLMAdapter {
  const provider = process.env.LLM_PROVIDER || "openai-compatible";

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");
    return new AnthropicAdapter(apiKey, process.env.ANTHROPIC_MODEL || "claude-sonnet-5");
  }

  if (provider === "openai-compatible") {
    const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL;
    if (!baseUrl) throw new Error("OPENAI_COMPATIBLE_BASE_URL is required when LLM_PROVIDER=openai-compatible");
    return new OpenAICompatibleAdapter(
      baseUrl,
      process.env.OPENAI_COMPATIBLE_API_KEY || "",
      process.env.OPENAI_COMPATIBLE_MODEL || "llama-3.1-70b-instruct"
    );
  }

  throw new Error(`Unknown LLM_PROVIDER '${provider}'`);
}
