export interface LLMCallbacks {
  onChunk: (chunk: string) => void;
  onEnd: (fullContent: string) => void;
  onError: (error: Error) => void;
}

export class LLMClient {
  private baseUrl: string;
  private apiKey: string | null;
  private model: string;

  constructor(baseUrl: string, apiKey: string | null, model: string) {
    this.baseUrl = baseUrl.replace(/\/(chat|models).*$/, "");
    if (!this.baseUrl.endsWith("/v1")) this.baseUrl += "/v1";
    this.apiKey = apiKey;
    this.model = model;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;
    return headers;
  }

  async streamChat(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    callbacks: LLMCallbacks,
    idleTimeoutMs: number = 90000
  ): Promise<string> {
    const controller = new AbortController();
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const url = `${this.baseUrl}/chat/completions`;
    const headers = this.getHeaders();
    const body = JSON.stringify({
      model: this.model,
      messages,
      temperature: 0.8,
      max_tokens: 8000,
      stream: true,
    });

    console.log(`[LLM] Connecting to: ${url}`);
    console.log(`[LLM] Model: ${this.model}`);
    console.log(`[LLM] Has API Key: ${!!this.apiKey}`);
    console.log(`[LLM] Headers: ${JSON.stringify(headers)}`);

    try {
      // Fetch without timeout signal - connection happens quickly
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`LLM API error ${response.status}: ${text}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      // Reset idle timer on each chunk received
      const resetIdleTimer = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          controller.abort();
          callbacks.onError(new Error(`LLM stream idle timeout after ${idleTimeoutMs / 1000}s (no chunks received)`));
        }, idleTimeoutMs);
      };

      // Start idle timer after first chunk delay allowance
      resetIdleTimer();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        resetIdleTimer();

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const content = json.choices?.[0]?.delta?.content || "";
            if (content) {
              fullContent += content;
              callbacks.onChunk(content);
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      clearTimeout(idleTimer);
      callbacks.onEnd(fullContent);
      return fullContent;

    } catch (error) {
      clearTimeout(idleTimer);

      const isConnectionRefused = error instanceof Error && (
        error.message.includes("ECONNREFUSED") ||
        error.cause instanceof Error && error.cause.message.includes("ECONNREFUSED")
      );

      if (error instanceof Error && error.name === "AbortError") {
        callbacks.onError(new Error(`LLM stream timed out after ${idleTimeoutMs / 1000}s (no progress)`));
      } else if (isConnectionRefused) {
        callbacks.onError(new Error(`LLM endpoint unreachable (${this.baseUrl}). Check that LM Studio is running and the port is correct.`));
      } else {
        callbacks.onError(error as Error);
      }
      throw error;
    }
  }
}
