import { describe, it, expect, vi } from "vitest";
import { saveGameSchema } from "../../shared/index.js";

describe("saveGameSchema", () => {
  it("should validate valid game ID", () => {
    const result = saveGameSchema.safeParse({ gameId: "game_123" });
    expect(result.success).toBe(true);
  });

  it("should reject empty game ID", () => {
    const result = saveGameSchema.safeParse({ gameId: "" });
    expect(result.success).toBe(false);
  });

  it("should reject missing gameId", () => {
    const result = saveGameSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
