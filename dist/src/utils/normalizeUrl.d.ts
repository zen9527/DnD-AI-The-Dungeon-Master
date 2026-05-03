/**
 * Normalize an LLM provider base URL to versioned base format.
 *
 * Strips known API path segments (/chat/completions, /models) from the end.
 * If no version segment (/v1, /v4, etc.) remains, appends /v1.
 * Returns a clean base URL that consumers append /chat/completions to.
 *
 * Examples (what consumers build: base + /chat/completions):
 *   LM Studio:  http://localhost:1234/v1             → .../v1/chat/completions ✓
 *   Ollama:     http://localhost:11434               → localhost:11434/v1/chat/completions ✓
 *   OpenAI:     https://api.openai.com/v1            → .../v1/chat/completions ✓
 *   Groq:       https://api.groq.com/openai/v1       → .../openai/v1/chat/completions ✓
 *   BigModel:   https://open.bigmodel.cn/api/paas/v4 → .../paas/v4/chat/completions ✓
 */
export declare function normalizeLlmBaseUrl(url: string): string;
//# sourceMappingURL=normalizeUrl.d.ts.map