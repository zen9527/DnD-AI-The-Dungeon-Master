import { describe, it, expect } from "vitest";
import { createLLMClient } from "../../src/llm/client.js";
import { AnthropicClient } from "../../src/llm/anthropic-client.js";
import { OpenAICompatibleClient } from "../../src/llm/openai-client.js";
import { configSchema, endpointPresets, llmProviderSchema } from "../../shared/schemas/config.js";

describe("createLLMClient", () => {
  it("returns the Anthropic client for the anthropic provider", () => {
    const client = createLLMClient({
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      apiKey: "sk-test",
      model: "claude-opus-5",
    });

    expect(client).toBeInstanceOf(AnthropicClient);
  });

  it("returns the OpenAI-compatible client for everything else", () => {
    const client = createLLMClient({
      provider: "openai-compatible",
      baseUrl: "http://localhost:1234/v1",
      apiKey: null,
      model: "local-model",
    });

    expect(client).toBeInstanceOf(OpenAICompatibleClient);
  });
});

describe("AnthropicClient request shaping", () => {
  const client = new AnthropicClient("sk-test", "claude-opus-5");
  // toRequest is the mapping that matters; reach past `private` to pin it down.
  const toRequest = (messages: Parameters<typeof client.streamChat>[0]) =>
    (client as unknown as { toRequest: (m: unknown) => { system: string; messages: unknown[] } }).toRequest(messages);

  it("lifts system turns into the top-level system parameter", () => {
    const result = toRequest([
      { role: "system", content: "You are the DM." },
      { role: "user", content: "I open the door." },
    ]);

    expect(result.system).toBe("You are the DM.");
    expect(result.messages).toEqual([{ role: "user", content: "I open the door." }]);
  });

  it("joins multiple system turns", () => {
    const result = toRequest([
      { role: "system", content: "Rule one." },
      { role: "system", content: "Rule two." },
      { role: "user", content: "Go." },
    ]);

    expect(result.system).toBe("Rule one.\n\nRule two.");
  });

  it("preserves user/assistant order for the conversation", () => {
    const result = toRequest([
      { role: "system", content: "sys" },
      { role: "user", content: "world state" },
      { role: "assistant", content: "Understood." },
      { role: "user", content: "I attack." },
    ]);

    expect(result.messages).toEqual([
      { role: "user", content: "world state" },
      { role: "assistant", content: "Understood." },
      { role: "user", content: "I attack." },
    ]);
  });

  it("rejects a prompt with no non-system turns", async () => {
    await expect(
      client.streamChat([{ role: "system", content: "only a system prompt" }], {
        onChunk: () => {},
        onEnd: () => {},
        onError: () => {},
      })
    ).rejects.toThrow(/at least one non-system message/);
  });
});

describe("provider config", () => {
  it("defaults to the OpenAI-compatible protocol when unspecified", () => {
    const parsed = configSchema.parse({ llmBaseUrl: "", llmApiKey: "", llmModel: "" });
    expect(parsed.llmProvider).toBe("openai-compatible");
  });

  it("accepts a blank base URL, which Claude does not need", () => {
    const parsed = configSchema.safeParse({
      llmBaseUrl: "",
      llmApiKey: "sk-test",
      llmModel: "claude-opus-5",
      llmProvider: "anthropic",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown provider", () => {
    expect(llmProviderSchema.safeParse("gemini").success).toBe(false);
  });

  it("tags every preset with a valid provider", () => {
    for (const preset of endpointPresets) {
      expect(llmProviderSchema.safeParse(preset.provider).success).toBe(true);
    }
  });

  it("ships a Claude preset pointing at a current model", () => {
    const claude = endpointPresets.find(p => p.provider === "anthropic");
    expect(claude).toBeDefined();
    expect(claude!.model).toBe("claude-opus-5");
  });
});
