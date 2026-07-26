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
 */
export interface LLMClient {
  streamChat(messages: LLMMessage[], callbacks: LLMCallbacks, idleTimeoutMs?: number): Promise<string>;
}

export const DEFAULT_IDLE_TIMEOUT_MS = 90000;
