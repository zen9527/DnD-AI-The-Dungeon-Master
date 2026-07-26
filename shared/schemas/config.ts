import { z } from "zod";

/**
 * Which wire protocol the endpoint speaks. `anthropic` uses the Messages API
 * via the official SDK; everything else uses OpenAI-compatible
 * `/chat/completions`, which covers local runtimes and most hosted vendors.
 */
export const llmProviderOptions = ["openai-compatible", "anthropic"] as const;
export const llmProviderSchema = z.enum(llmProviderOptions);
export type LLMProviderId = (typeof llmProviderOptions)[number];

export const configSchema = z.object({
  // Anthropic uses the SDK's own endpoint, so the URL may be blank there.
  llmBaseUrl: z.string().min(0),
  llmApiKey: z.string().min(0),
  llmModel: z.string().min(0),
  llmProvider: llmProviderSchema.default("openai-compatible"),
});

export type ConfigInput = z.infer<typeof configSchema>;

export const ANTHROPIC_BASE_URL = "https://api.anthropic.com";

/** Fallback list for the model dropdown when the models endpoint can't be reached. */
export const ANTHROPIC_MODELS = [
  "claude-opus-5",
  "claude-sonnet-5",
  "claude-haiku-4-5",
] as const;

export const endpointPresets = [
  {
    name: "Claude (Anthropic)",
    provider: "anthropic",
    url: ANTHROPIC_BASE_URL,
    apiKey: "",
    model: "claude-opus-5",
  },
  {
    name: "LM Studio",
    provider: "openai-compatible",
    url: "http://localhost:1234/v1",
    apiKey: "",
    model: "",
  },
  {
    name: "Ollama",
    provider: "openai-compatible",
    url: "http://localhost:11434/v1",
    apiKey: "",
    model: "",
  },
  {
    name: "OpenAI",
    provider: "openai-compatible",
    url: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4",
  },
  {
    name: "Together AI",
    provider: "openai-compatible",
    url: "https://api.together.xyz/v1",
    apiKey: "",
    model: "meta-llama/Meta-Llama-3-8B-Instruct-Turbo",
  },
  {
    name: "Groq",
    provider: "openai-compatible",
    url: "https://api.groq.com/openai/v1",
    apiKey: "",
    model: "llama3-70b-8192",
  },
  {
    name: "BigModel (GLM)",
    provider: "openai-compatible",
    url: "https://open.bigmodel.cn/api/paas/v4",
    apiKey: "",
    model: "",
  },
  {
    name: "Custom",
    provider: "openai-compatible",
    url: "",
    apiKey: "",
    model: "",
  },
] as const;

export type EndpointPreset = (typeof endpointPresets)[number];
