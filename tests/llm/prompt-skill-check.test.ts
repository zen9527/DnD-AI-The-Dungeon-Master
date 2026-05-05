import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../../src/llm/prompts.js";

describe("buildSystemPrompt - Skill Check JSON Output", () => {
  it("should include diceResult output format instructions", () => {
    const prompt = buildSystemPrompt("dungeon", "zh-CN");
    
    // Verify prompt includes skill check JSON output requirements
    expect(prompt).toContain("diceResult");
    expect(prompt).toContain("skill");
    expect(prompt).toContain("dc");
    expect(prompt).toContain("success");
  });

  it("should include example JSON output for skill checks", () => {
    const prompt = buildSystemPrompt("dungeon", "zh-CN");
    
    // Verify prompt includes example format
    expect(prompt).toContain("JSON OUTPUT FORMAT FOR SKILL CHECKS");
  });
});
