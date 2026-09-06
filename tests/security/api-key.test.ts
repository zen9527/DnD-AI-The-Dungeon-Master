import { describe, it, expect } from "vitest";
import { maskApiKey } from "../../src/utils/secrets.js";
import { LLMRateLimiter } from "../../src/websocket/rate-limit.js";

/**
 * `GET /api/config` used to return the raw key so the settings dialog could
 * pre-fill the field — meaning any browser that could reach the server could
 * read it. The dialog is read-only now, and these guard what remains: the key
 * is displayed masked and never travels back over HTTP in either direction.
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

  it("keeps game setup and the turn loop on separate budgets", () => {
    const limiter = new LLMRateLimiter(2, 60_000);

    // Exhausting the turn budget must not lock the player out of starting a game.
    expect(limiter.tryConsume("c1", "PLAYER_ACTION")).toBe(true);
    expect(limiter.tryConsume("c1", "PLAYER_ACTION")).toBe(true);
    expect(limiter.tryConsume("c1", "PLAYER_ACTION")).toBe(false);

    expect(limiter.tryConsume("c1", "CREATE_GAME")).toBe(true);
    expect(limiter.tryConsume("c1", "JOIN_GAME")).toBe(true);
    expect(limiter.tryConsume("c1", "CREATE_GAME")).toBe(false);
  });

  it("leaves real play far below the limit", () => {
    // The default budget must never bite a person: the socket lives for the
    // whole session, so an over-tight limit reads as "the app stopped working".
    const limiter = new LLMRateLimiter();
    for (let i = 0; i < 25; i++) {
      expect(limiter.tryConsume("c1", "PLAYER_ACTION"), `turn ${i + 1}`).toBe(true);
    }
    for (let i = 0; i < 15; i++) {
      expect(limiter.tryConsume("c1", "CREATE_GAME"), `game ${i + 1}`).toBe(true);
    }
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
    const retryAfter = limiter.retryAfterSeconds("c1", "PLAYER_ACTION", start + 10_000);

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
