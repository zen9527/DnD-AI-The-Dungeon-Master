import { describe, it, expect } from "vitest";
import { getActionSkillCheck } from "../../src/game/rules.js";
import { presetActionIds } from "../../shared/schemas/action.js";
import enUS from "../../locales/en-US.json";
import zhCN from "../../locales/zh-CN.json";
import jaJP from "../../locales/ja-JP.json";
import esES from "../../locales/es-ES.json";
import koKR from "../../locales/ko-KR.json";

/**
 * The action-bar buttons send localized text ("我攻击我的目标"), so English
 * keyword matching alone silently disables every automatic dice roll outside
 * English. The preset id is what keeps the mechanic working in all five.
 */

const LOCALES = { "en-US": enUS, "zh-CN": zhCN, "ja-JP": jaJP, "es-ES": esES, "ko-KR": koKR } as const;

/** Action-bar button -> the locale key holding the text it sends. */
const PRESET_TEXT_KEYS = {
  attack: "action.attack_text",
  search: "action.search_text",
  talk: "action.talk_text",
  hide: "action.hide_text",
  arcana: "action.intelligence_text",
  defend: "action.defend_text",
} as const;

describe("getActionSkillCheck", () => {
  it("resolves every preset id to a skill check", () => {
    for (const id of presetActionIds) {
      expect(getActionSkillCheck("", id), `preset "${id}"`).not.toBeNull();
    }
  });

  it("fires for every preset button in every language", () => {
    for (const [locale, strings] of Object.entries(LOCALES)) {
      for (const [id, key] of Object.entries(PRESET_TEXT_KEYS)) {
        const localizedText = (strings as Record<string, string>)[key];
        const check = getActionSkillCheck(localizedText, id as keyof typeof PRESET_TEXT_KEYS);
        expect(check, `${locale} / ${id} ("${localizedText}")`).not.toBeNull();
      }
    }
  });

  it("maps each preset to the skill a player would expect", () => {
    expect(getActionSkillCheck("", "attack")?.skill).toBe("Attack");
    expect(getActionSkillCheck("", "hide")?.skill).toBe("Stealth");
    expect(getActionSkillCheck("", "search")?.skill).toBe("Perception");
    expect(getActionSkillCheck("", "talk")?.skill).toBe("Persuasion");
    expect(getActionSkillCheck("", "arcana")?.skill).toBe("Arcana");
    expect(getActionSkillCheck("", "defend")?.skill).toBe("Dodge");
  });

  it("still keyword-matches free text with no preset id", () => {
    expect(getActionSkillCheck("I try to sneak past the guard")?.skill).toBe("Stealth");
    expect(getActionSkillCheck("climb the wall")?.skill).toBe("Athletics");
  });

  it("prefers the preset id over misleading text", () => {
    // "hide" appears in the text, but the player pressed Search.
    expect(getActionSkillCheck("I hide nothing and search openly", "search")?.skill).toBe("Perception");
  });

  it("returns null for text that maps to no skill", () => {
    expect(getActionSkillCheck("I stand around thinking")).toBeNull();
  });
});
