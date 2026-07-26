import Anthropic from "@anthropic-ai/sdk";
import type { Request, Response } from "express";
import { configManager } from "../utils/config.js";
import { normalizeLlmBaseUrl } from "../utils/normalizeUrl.js";
import {
  ANTHROPIC_MODELS,
  configSchema,
  llmProviderSchema,
  type LLMProviderId,
} from "../../shared/schemas/config.js";

const PROBE_TIMEOUT_MS = 10000;

/** GET /api/config — current LLM settings for the settings dialog. */
export function getConfigHandler(_req: Request, res: Response): void {
  const config = configManager.read();
  res.json({
    llmBaseUrl: config.llmBaseUrl,
    llmApiKey: config.llmApiKey || "",
    llmModel: config.llmModel,
    llmProvider: config.llmProvider,
  });
}

/** POST /api/config — persist LLM settings to .env. */
export function postConfigHandler(req: Request, res: Response): void {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
    return;
  }

  const { llmBaseUrl, llmApiKey, llmModel, llmProvider } = parsed.data;
  configManager.write({ llmBaseUrl, llmApiKey, llmModel, llmProvider });

  console.log(`[Config] LLM updated: ${llmProvider} — ${llmModel}`);
  // Running games hold a client built at creation time, so a restart is needed.
  res.json({ success: true, restartRequired: true });
}

/** List the models Claude offers this API key. */
async function listAnthropicModels(apiKey: string): Promise<{ models: string[]; error: string | null }> {
  if (!apiKey) {
    return { models: [...ANTHROPIC_MODELS], error: null };
  }

  try {
    const client = new Anthropic({ apiKey, timeout: PROBE_TIMEOUT_MS });
    const models: string[] = [];
    for await (const model of client.models.list()) {
      models.push(model.id);
    }
    return { models, error: null };
  } catch (error) {
    // Fall back to the known-good list so the dropdown is never empty.
    const message = error instanceof Error ? error.message : "Unknown error";
    return { models: [...ANTHROPIC_MODELS], error: `Could not reach Anthropic (${message}); showing defaults` };
  }
}

/** List the models an OpenAI-compatible endpoint offers. */
async function listOpenAICompatibleModels(
  baseUrl: string,
  apiKey: string
): Promise<{ models: string[]; error: string | null }> {
  if (!baseUrl) return { models: [], error: null };

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const response = await fetch(`${normalizeLlmBaseUrl(baseUrl)}/models`, {
      headers,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    if (!response.ok) return { models: [], error: `HTTP ${response.status}` };

    const data = (await response.json()) as { data?: { id: string }[] };
    return { models: data.data?.map(m => m.id) || [], error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { models: [], error: `Failed to fetch models: ${message}` };
  }
}

/** GET /api/config/models — populate the model dropdown for either provider. */
export async function getModelsHandler(req: Request, res: Response): Promise<void> {
  const provider = resolveProvider(req.query.provider);
  const apiKey = (req.query.key as string) || "";

  const result = provider === "anthropic"
    ? await listAnthropicModels(apiKey)
    : await listOpenAICompatibleModels((req.query.url as string) || "", apiKey);

  res.json(result);
}

/** Send a one-token request to prove the endpoint, key, and model all work. */
async function testAnthropic(apiKey: string, model: string): Promise<{ connected: boolean; message: string }> {
  if (!apiKey) return { connected: false, message: "An API key is required for Claude" };

  try {
    const client = new Anthropic({ apiKey, timeout: PROBE_TIMEOUT_MS });
    await client.messages.create({
      model: model || "claude-opus-5",
      max_tokens: 1,
      messages: [{ role: "user", content: "test" }],
    });
    return { connected: true, message: "Claude reachable" };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { connected: false, message: "Invalid API key" };
    }
    if (error instanceof Anthropic.NotFoundError) {
      return { connected: false, message: `Model "${model}" not found` };
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return { connected: false, message: `Connection failed: ${message}` };
  }
}

async function testOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<{ connected: boolean; message: string }> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const response = await fetch(`${normalizeLlmBaseUrl(baseUrl)}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model || "test",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    if (response.ok) return { connected: true, message: "LLM endpoint reachable" };

    const text = await response.text();
    return { connected: false, message: `HTTP ${response.status}: ${text.substring(0, 200)}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { connected: false, message: `Connection failed: ${message}` };
  }
}

/** POST /api/config/test — verify settings before saving them. */
export async function postConfigTestHandler(req: Request, res: Response): Promise<void> {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
    return;
  }

  const { llmBaseUrl, llmApiKey, llmModel, llmProvider } = parsed.data;

  res.json(
    llmProvider === "anthropic"
      ? await testAnthropic(llmApiKey, llmModel)
      : await testOpenAICompatible(llmBaseUrl, llmApiKey, llmModel)
  );
}

/** Unknown or missing provider means the legacy OpenAI-compatible path. */
function resolveProvider(value: unknown): LLMProviderId {
  const parsed = llmProviderSchema.safeParse(value);
  return parsed.success ? parsed.data : "openai-compatible";
}
