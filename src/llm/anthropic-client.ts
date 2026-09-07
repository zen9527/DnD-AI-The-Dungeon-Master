import { log } from "../utils/logger.js";
import Anthropic from "@anthropic-ai/sdk";
import { resolveIdleTimeout, type LLMCallbacks, type LLMClient, type LLMMessage } from "./types.js";

const MAX_TOKENS = 8000;

/**
 * Claude narrates a live table with a turn timer running, so depth is traded
 * for responsiveness: adaptive thinking stays on, but at low effort.
 */
const EFFORT = "low";

/**
 * Opt into server-side refusal fallbacks. Claude's safety classifiers can
 * decline a request outright; `"default"` lets Anthropic re-run it on the
 * recommended fallback model instead of the turn dying.
 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/**
 * Streaming client for the Anthropic Messages API.
 *
 * Note the shape difference from OpenAI-compatible endpoints: Claude takes the
 * system prompt as a top-level parameter rather than a message with
 * `role: "system"`, so `toRequest` lifts those out of the message list.
 */
export class AnthropicClient implements LLMClient {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string | null, model: string, baseUrl?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || undefined,
      // Only override the endpoint for a gateway/proxy; otherwise use the SDK default.
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });
    this.model = model;
  }

  /**
   * Split our flat message list into Claude's `system` + `messages` shape.
   * Multiple system turns are joined; the API tolerates consecutive same-role
   * messages, so no further reshaping is needed.
   */
  private toRequest(messages: LLMMessage[]): { system: string; messages: Anthropic.MessageParam[] } {
    const system = messages
      .filter(m => m.role === "system")
      .map(m => m.content)
      .join("\n\n");

    const conversation = messages
      .filter(m => m.role !== "system")
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    return { system, messages: conversation };
  }

  async streamChat(
    messages: LLMMessage[],
    callbacks: LLMCallbacks,
    idleTimeoutMs?: number,
    signal?: AbortSignal
  ): Promise<string> {
    const timeout = resolveIdleTimeout(idleTimeoutMs);
    const { system, messages: conversation } = this.toRequest(messages);

    if (conversation.length === 0) {
      const error = new Error("Anthropic requires at least one non-system message");
      callbacks.onError(error);
      throw error;
    }

    log.info(`[LLM] Anthropic messages.stream (model: ${this.model}, effort: ${EFFORT})`);

    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    let userCancelled = false;

    try {
      const stream = this.client.beta.messages.stream(
        {
          model: this.model,
          max_tokens: MAX_TOKENS,
          ...(system ? { system } : {}),
          messages: conversation,
          thinking: { type: "adaptive" },
          output_config: { effort: EFFORT },
          betas: [FALLBACK_BETA],
          fallbacks: "default",
        },
        { timeout }
      );

      if (signal) {
        const onAbort = () => {
          userCancelled = true;
          stream.abort();
        };
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      }

      const resetIdleTimer = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          timedOut = true;
          stream.abort();
        }, timeout);
      };
      resetIdleTimer();

      let fullContent = "";
      // `text` yields only the visible answer — thinking blocks never reach the
      // narrative, so the ---JSON--- parser downstream is unaffected.
      stream.on("text", delta => {
        fullContent += delta;
        resetIdleTimer();
        callbacks.onChunk(delta);
      });

      const message = await stream.finalMessage();
      clearTimeout(idleTimer);

      if (message.stop_reason === "refusal") {
        throw new Error(
          `Claude declined this request (${message.stop_details?.category ?? "unspecified"}). Try rephrasing the action.`
        );
      }

      callbacks.onEnd(fullContent);
      return fullContent;
    } catch (error) {
      clearTimeout(idleTimer);
      const wrapped = userCancelled
        ? new Error("LLM stream cancelled by player")
        : this.describeError(error, timeout, timedOut);
      callbacks.onError(wrapped);
      throw wrapped;
    }
  }

  /**
   * Normalize SDK errors into the same vocabulary the OpenAI-compatible client
   * uses, so the opening-scene retry logic classifies them identically.
   */
  private describeError(error: unknown, idleTimeoutMs: number, timedOut: boolean): Error {
    if (timedOut) {
      return new Error(`LLM stream idle timeout after ${idleTimeoutMs / 1000}s (no chunks received)`);
    }

    if (error instanceof Anthropic.APIConnectionError) {
      return new Error("LLM endpoint unreachable (api.anthropic.com). Check your network connection.");
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return new Error("Anthropic rejected the API key. Check the key in Settings.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      return new Error("Anthropic rate limit reached. Wait a moment and try again.");
    }
    if (error instanceof Anthropic.NotFoundError) {
      return new Error(`Model "${this.model}" not found. Pick a different model in Settings.`);
    }
    if (error instanceof Anthropic.APIError) {
      return new Error(`LLM API error ${error.status}: ${error.message}`);
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}
