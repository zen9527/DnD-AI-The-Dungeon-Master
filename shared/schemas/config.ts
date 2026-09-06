import { z } from "zod";

/** Supported LLM wire protocols, selected by `LLM_PROVIDER` in `.env`. */
export const llmProviderOptions = ["openai-compatible", "anthropic"] as const;
export const llmProviderSchema = z.enum(llmProviderOptions);
export type LLMProviderId = (typeof llmProviderOptions)[number];
