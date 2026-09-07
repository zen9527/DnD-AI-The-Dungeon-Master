import { describe, it, expect, afterEach } from "vitest";
import { DEFAULT_IDLE_TIMEOUT_MS, resolveIdleTimeout } from "../../src/llm/types.js";

describe("resolveIdleTimeout", () => {
  const original = process.env.LLM_IDLE_TIMEOUT_MS;

  afterEach(() => {
    if (original === undefined) delete process.env.LLM_IDLE_TIMEOUT_MS;
    else process.env.LLM_IDLE_TIMEOUT_MS = original;
  });

  it("prefers a per-call override", () => {
    process.env.LLM_IDLE_TIMEOUT_MS = "30000";
    expect(resolveIdleTimeout(60000)).toBe(60000);
  });

  it("honours LLM_IDLE_TIMEOUT_MS when no override is given", () => {
    process.env.LLM_IDLE_TIMEOUT_MS = "25000";
    expect(resolveIdleTimeout()).toBe(25000);
  });

  it("falls back to the default for a missing or nonsense value", () => {
    delete process.env.LLM_IDLE_TIMEOUT_MS;
    expect(resolveIdleTimeout()).toBe(DEFAULT_IDLE_TIMEOUT_MS);

    process.env.LLM_IDLE_TIMEOUT_MS = "not-a-number";
    expect(resolveIdleTimeout()).toBe(DEFAULT_IDLE_TIMEOUT_MS);

    process.env.LLM_IDLE_TIMEOUT_MS = "-5";
    expect(resolveIdleTimeout()).toBe(DEFAULT_IDLE_TIMEOUT_MS);
  });

  it("defaults to 45 seconds of silence", () => {
    expect(DEFAULT_IDLE_TIMEOUT_MS).toBe(45000);
  });
});
