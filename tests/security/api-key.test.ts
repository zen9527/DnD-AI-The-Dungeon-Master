import { describe, it, expect } from "vitest";
import { maskApiKey, isMaskedApiKey, resolveApiKey } from "../../src/utils/secrets.js";
import { LLMRateLimiter } from "../../src/websocket/rate-limit.js";

/**
 * `GET /api/config` used to return the raw key so the settings dialog could
 * pre-fill the field — meaning any browser that could reach the server could
 * read it. These guard the mask-and-restore scheme that replaced it.
 */
describe("API key masking", () => {
  const REAL_KEY = "sk-ant-api03-abcdefghijklmnop4f2a";

  it("never returns the full key", () => {
    const masked = maskApiKey(REAL_KEY);
    expect(masked).not.toBe(REAL_KEY);
    expect(masked).not.toContain("abcdefghijklmnop");
  });

  it("reveals just enough to recognise which key is configured", () => {
    const masked = maskApiKey(REAL_KEY);
    expect(masked.startsWith("sk-ant")).toBe(true);
    expect(masked.endsWith("4f2a")).toBe(true);
  });

  it("reveals nothing at all for a short secret", () => {
    expect(maskApiKey("abc123")).not.toContain("abc");
  });

  it("reports an unset key as empty rather than a mask", () => {
    expect(maskApiKey("")).toBe("");
    expect(maskApiKey(null)).toBe("");
  });

  it("recognises its own output as a mask", () => {
    expect(isMaskedApiKey(maskApiKey(REAL_KEY))).toBe(true);
    expect(isMaskedApiKey(REAL_KEY)).toBe(false);
  });
});

describe("resolveApiKey", () => {
  const STORED = "sk-ant-api03-abcdefghijklmnop4f2a";

  it("keeps the stored key when the field comes back untouched", () => {
    expect(resolveApiKey(maskApiKey(STORED), STORED)).toBe(STORED);
  });

  it("accepts a genuinely new key", () => {
    expect(resolveApiKey("sk-ant-brand-new-key-value", STORED)).toBe("sk-ant-brand-new-key-value");
  });

  it("lets an emptied field clear the key", () => {
    expect(resolveApiKey("", STORED)).toBe("");
  });

  it("does not resurrect a key that was never stored", () => {
    expect(resolveApiKey("", null)).toBe("");
  });
});

/**
 * There is no authentication, so anyone with the game link can send messages
 * that cost LLM tokens. This bounds what a single connection can spend.
 */
describe("LLMRateLimiter", () => {
  it("only counts messages that actually call the LLM", () => {
    const limiter = new LLMRateLimiter(1, 60_000);

    expect(limiter.tryConsume("c1", "PLAYER_ACTION")).toBe(true);
    // Chat, dice and DM controls are free and must stay unlimited.
    for (const type of ["CHAT_MESSAGE", "DICE_ROLL", "NPC_UPDATE_HP"] as const) {
      expect(limiter.tryConsume("c1", type), type).toBe(true);
    }
  });

  it("blocks a client that exhausts its budget", () => {
    const limiter = new LLMRateLimiter(3, 60_000);

    for (let i = 0; i < 3; i++) {
      expect(limiter.tryConsume("c1", "PLAYER_ACTION")).toBe(true);
    }
    expect(limiter.tryConsume("c1", "PLAYER_ACTION")).toBe(false);
  });

  it("budgets each connection separately", () => {
    const limiter = new LLMRateLimiter(1, 60_000);

    expect(limiter.tryConsume("c1", "PLAYER_ACTION")).toBe(true);
    expect(limiter.tryConsume("c1", "PLAYER_ACTION")).toBe(false);
    expect(limiter.tryConsume("c2", "PLAYER_ACTION")).toBe(true);
  });

  it("lets the window slide", () => {
    const limiter = new LLMRateLimiter(2, 1000);
    const start = 10_000;

    expect(limiter.tryConsume("c1", "PLAYER_ACTION", start)).toBe(true);
    expect(limiter.tryConsume("c1", "PLAYER_ACTION", start + 100)).toBe(true);
    expect(limiter.tryConsume("c1", "PLAYER_ACTION", start + 200)).toBe(false);

    // Once the first two age out, the budget is available again.
    expect(limiter.tryConsume("c1", "PLAYER_ACTION", start + 1500)).toBe(true);
  });

  it("reports a usable retry delay", () => {
    const limiter = new LLMRateLimiter(1, 60_000);
    const start = 10_000;

    limiter.tryConsume("c1", "PLAYER_ACTION", start);
    const retryAfter = limiter.retryAfterSeconds("c1", start + 10_000);

    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it("forgets a connection once its socket closes", () => {
    const limiter = new LLMRateLimiter(1, 60_000);

    limiter.tryConsume("c1", "PLAYER_ACTION");
    limiter.forget("c1");

    expect(limiter.tryConsume("c1", "PLAYER_ACTION")).toBe(true);
  });
});
