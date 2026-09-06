import Anthropic from "@anthropic-ai/sdk";
import type { Request, Response } from "express";
import { log } from "../utils/logger.js";
import { configManager } from "../utils/config.js";
import { normalizeLlmBaseUrl } from "../utils/normalizeUrl.js";
import { maskApiKey } from "../utils/secrets.js";

const PROBE_TIMEOUT_MS = 10000;

/**
 * GET /api/config — the current LLM settings, for the read-only dialog.
 * `.env` is the only way to change them; there is no write endpoint by design,
 * so nothing on the LAN can rewrite this machine's credentials over HTTP.
 */
export function getConfigHandler(_req: Request, res: Response): void {
  const config = configManager.read();
  res.json({
    llmBaseUrl: config.llmBaseUrl,
    // Masked: anyone who can reach this endpoint would otherwise read the key.
    llmApiKey: maskApiKey(config.llmApiKey),
    llmModel: config.llmModel,
    llmProvider: config.llmProvider,
  });
}

/** Send a one-token request to prove the stored endpoint, key, and model work. */
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

/** POST /api/config/test — probe the stored `.env` config. No body. */
export async function postConfigTestHandler(_req: Request, res: Response): Promise<void> {
  const config = configManager.read();
  log.info(`[Config] Testing stored LLM config: ${config.llmProvider} — ${config.llmModel}`);

  const result = config.llmProvider === "anthropic"
    ? await testAnthropic(config.llmApiKey ?? "", config.llmModel)
    : await testOpenAICompatible(config.llmBaseUrl, config.llmApiKey ?? "", config.llmModel);

  res.json(result);
}
