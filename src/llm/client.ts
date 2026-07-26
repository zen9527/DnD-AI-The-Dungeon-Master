import { AnthropicClient } from "./anthropic-client.js";
import { OpenAICompatibleClient } from "./openai-client.js";
import type { LLMClient, LLMConfig } from "./types.js";

export type { LLMCallbacks, LLMClient, LLMConfig, LLMMessage, LLMProviderId } from "./types.js";

/**
 * Build the streaming client for the configured provider.
 *
 * `anthropic` talks to the Messages API through the official SDK; everything
 * else speaks the OpenAI-compatible `/chat/completions` protocol, which covers
 * local runtimes (LM Studio, Ollama) and most hosted vendors.
 */
export function createLLMClient(config: LLMConfig): LLMClient {
  if (config.provider === "anthropic") {
    // A base URL is only meaningful here when pointing at a gateway or proxy.
    const isDefaultEndpoint = !config.baseUrl || config.baseUrl.includes("api.anthropic.com");
    return new AnthropicClient(config.apiKey, config.model, isDefaultEndpoint ? undefined : config.baseUrl);
  }

  return new OpenAICompatibleClient(config.baseUrl, config.apiKey, config.model);
}
