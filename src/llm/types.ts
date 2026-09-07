/** A single turn in the prompt sent to the model. */
export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCallbacks {
  onChunk: (chunk: string) => void;
  onEnd: (fullContent: string) => void;
  onError: (error: Error) => void;
}

/** Which wire protocol to speak. */
export type LLMProviderId = "openai-compatible" | "anthropic";

export interface LLMConfig {
  provider: LLMProviderId;
  baseUrl: string;
  apiKey: string | null;
  model: string;
}

/**
 * A streaming chat backend.
 *
 * Implementations stream text to `onChunk` as it arrives and resolve with the
 * full text. On failure they call `onError` **and** reject, so callers can use
 * either style — the game engine relies on the rejection.
 *
 * `signal` aborts generation from the outside (a player hitting Stop); the
 * idle timeout guards against a stream that goes silent on its own.
 */
export interface LLMClient {
  streamChat(
    messages: LLMMessage[],
    callbacks: LLMCallbacks,
    idleTimeoutMs?: number,
    signal?: AbortSignal
  ): Promise<string>;
}

export const DEFAULT_IDLE_TIMEOUT_MS = 45000;

/**
 * Per-call override → `LLM_IDLE_TIMEOUT_MS` from .env → built-in default.
 * The timer resets on every chunk, so this bounds silence, not length.
 */
export function resolveIdleTimeout(override?: number): number {
  if (override && override > 0) return override;
  const fromEnv = Number(process.env.LLM_IDLE_TIMEOUT_MS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_IDLE_TIMEOUT_MS;
}
