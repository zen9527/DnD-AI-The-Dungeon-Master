import { normalizeLlmBaseUrl } from "../utils/normalizeUrl.js";
import { DEFAULT_IDLE_TIMEOUT_MS, type LLMCallbacks, type LLMClient, type LLMMessage } from "./types.js";

/** Sampling settings tuned for descriptive DM narration. */
const TEMPERATURE = 0.8;
const MAX_TOKENS = 8000;

/**
 * Streaming client for any OpenAI-compatible `/chat/completions` endpoint —
 * LM Studio, Ollama, OpenAI, Groq, Together, GLM, and friends.
 *
 * The idle timeout is reset on every chunk, so a slow-but-progressing local
 * model is never cut off; only a genuinely stalled stream aborts.
 */
export class OpenAICompatibleClient implements LLMClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;
  private readonly model: string;

  constructor(baseUrl: string, apiKey: string | null, model: string) {
    this.baseUrl = normalizeLlmBaseUrl(baseUrl);
    this.apiKey = apiKey;
    this.model = model;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;
    return headers;
  }

  async streamChat(
    messages: LLMMessage[],
    callbacks: LLMCallbacks,
    idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS
  ): Promise<string> {
    const controller = new AbortController();
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const url = `${this.baseUrl}/chat/completions`;

    console.log(`[LLM] POST ${url} (model: ${this.model}, auth: ${this.apiKey ? "yes" : "no"})`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: TEMPERATURE,
          max_tokens: MAX_TOKENS,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error ${response.status}: ${await response.text()}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      const resetIdleTimer = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          controller.abort();
        }, idleTimeoutMs);
      };
      resetIdleTimer();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        resetIdleTimer();

        // SSE frames are newline-delimited; the trailing partial line carries over.
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ") || trimmed === "data: [DONE]") continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const content = json.choices?.[0]?.delta?.content || "";
            if (content) {
              fullContent += content;
              callbacks.onChunk(content);
            }
          } catch {
            // Skip malformed SSE frames rather than failing the whole turn.
          }
        }
      }

      clearTimeout(idleTimer);
      callbacks.onEnd(fullContent);
      return fullContent;
    } catch (error) {
      clearTimeout(idleTimer);
      const wrapped = this.describeError(error, idleTimeoutMs);
      callbacks.onError(wrapped);
      throw wrapped;
    }
  }

  /** Turn transport failures into messages the retry logic can classify. */
  private describeError(error: unknown, idleTimeoutMs: number): Error {
    if (error instanceof Error && error.name === "AbortError") {
      return new Error(`LLM stream idle timeout after ${idleTimeoutMs / 1000}s (no chunks received)`);
    }

    const connectionRefused =
      error instanceof Error &&
      (error.message.includes("ECONNREFUSED") ||
        (error.cause instanceof Error && error.cause.message.includes("ECONNREFUSED")));

    if (connectionRefused) {
      return new Error(`LLM endpoint unreachable (${this.baseUrl}). Check that the server is running and the port is correct.`);
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}
