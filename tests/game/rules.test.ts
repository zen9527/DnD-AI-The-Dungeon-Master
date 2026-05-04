import { describe, it, expect } from "vitest";
import { getActionSkillCheck, getConditionModifier, applyCondition, removeCondition, CONDITIONS } from "../../src/game/rules.js";
import type { Player } from "../../src/types/index.js";

describe("getConditionModifier", () => {
  it("should return disadvantage for poisoned condition", () => {
    const modifier = getConditionModifier(["poisoned"]);
    expect(modifier).toEqual({ attackAdvantage: false, checkAdvantage: false });
  });

  it("should return advantage for attacking prone target", () => {
    const modifier = getConditionModifier([], ["prone"]);
    expect(modifier).toEqual({ attackAdvantage: true });
  });

  it("should return disadvantage for blinded condition", () => {
    const modifier = getConditionModifier(["blinded"]);
    expect(modifier).toEqual({ attackAdvantage: false, checkAdvantage: false, saveAdvantage: true });
  });

  it("should return advantage for invisible attacker", () => {
    const modifier = getConditionModifier([], ["invisible"]);
    expect(modifier).toEqual({ attackAdvantage: false }); // Invisible makes target hard to hit (attacker has advantage)
  });

  it("should return disadvantage for frightened condition", () => {
    const modifier = getConditionModifier(["frightened"]);
    expect(modifier).toEqual({ attackAdvantage: false, checkAdvantage: false });
  });

  it("should return no modifiers for empty conditions", () => {
    const modifier = getConditionModifier([]);
    expect(modifier).toEqual({});
  });

  it("should combine self and target conditions", () => {
    const modifier = getConditionModifier(["poisoned"], ["prone"]);
    expect(modifier).toEqual({ attackAdvantage: true, checkAdvantage: false });
  });
});

describe("applyCondition", () => {
  it("should add condition to player", () => {
    const player: Player = {
      id: "1",
      name: "Test Player",
      characterName: "Test Character",
      isDM: false,
      race: "Human",
      characterClass: "Fighter",
      level: 1,
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      hp: 10,
      maxHp: 10,
      ac: 10,
      proficiencyBonus: 2,
      spellSlots: {},
      spells: [],
      inventory: [],
      conditions: [],
      hitDice: { total: 10, used: 0 },
      deathSaves: { successes: 0, failures: 0 },
      xp: 0,
      locale: "en-US"
    };

    applyCondition(player, "poisoned");
    expect(player.conditions).toContain("poisoned");
  });

  it("should not duplicate condition", () => {
    const player: Player = {
      id: "1",
      name: "Test Player",
      characterName: "Test Character",
      isDM: false,
      race: "Human",
      characterClass: "Fighter",
      level: 1,
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      hp: 10,
      maxHp: 10,
      ac: 10,
      proficiencyBonus: 2,
      spellSlots: {},
      spells: [],
      inventory: [],
      conditions: ["poisoned"],
      hitDice: { total: 10, used: 0 },
      deathSaves: { successes: 0, failures: 0 },
      xp: 0,
      locale: "en-US"
    };

    applyCondition(player, "poisoned");
    expect(player.conditions.filter(c => c === "poisoned").length).toBe(1);
  });

  it("should warn for unknown condition", () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation();
    const player: Player = {
      id: "1",
      name: "Test Player",
      characterName: "Test Character",
      isDM: false,
      race: "Human",
      characterClass: "Fighter",
      level: 1,
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      hp: 10,
      maxHp: 10,
      ac: 10,
      proficiencyBonus: 2,
      spellSlots: {},
      spells: [],
      inventory: [],
      conditions: [],
      hitDice: { total: 10, used: 0 },
      deathSaves: { successes: 0, failures: 0 },
      xp: 0,
      locale: "en-US"
    };

    applyCondition(player, "unknown_condition");
    expect(consoleWarn).toHaveBeenCalledWith("Unknown condition: unknown_condition");
    consoleWarn.mockRestore();
  });
});

describe("removeCondition", () => {
  it("should remove condition from player", () => {
    const player: Player = {
      id: "1",
      name: "Test Player",
      characterName: "Test Character",
      isDM: false,
      race: "Human",
      characterClass: "Fighter",
      level: 1,
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      hp: 10,
      maxHp: 10,
      ac: 10,
      proficiencyBonus: 2,
      spellSlots: {},
      spells: [],
      inventory: [],
      conditions: ["poisoned", "prone"],
      hitDice: { total: 10, used: 0 },
      deathSaves: { successes: 0, failures: 0 },
      xp: 0,
      locale: "en-US"
    };

    removeCondition(player, "poisoned");
    expect(player.conditions).not.toContain("poisoned");
    expect(player.conditions).toContain("prone");
  });

  it("should handle removing non-existent condition", () => {
    const player: Player = {
      id: "1",
      name: "Test Player",
      characterName: "Test Character",
      isDM: false,
      race: "Human",
      characterClass: "Fighter",
      level: 1,
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      hp: 10,
      maxHp: 10,
      ac: 10,
      proficiencyBonus: 2,
      spellSlots: {},
      spells: [],
      inventory: [],
      conditions: ["poisoned"],
      hitDice: { total: 10, used: 0 },
      deathSaves: { successes: 0, failures: 0 },
      xp: 0,
      locale: "en-US"
    };

    removeCondition(player, "nonexistent");
    expect(player.conditions).toEqual(["poisoned"]);
  });
});

describe("CONDITIONS", () => {
  it("should define all standard D&D 5e conditions", () => {
    expect(CONDITIONS["poisoned"]).toBeDefined();
    expect(CONDITIONS["prone"]).toBeDefined();
    expect(CONDITIONS["blinded"]).toBeDefined();
    expect(CONDITIONS["charmed"]).toBeDefined();
    expect(CONDITIONS["frightened"]).toBeDefined();
    expect(CONDITIONS["grappled"]).toBeDefined();
    expect(CONDITIONS["stunned"]).toBeDefined();
    expect(CONDITIONS["invisible"]).toBeDefined();
  });

  it("should have correct effects for poisoned", () => {
    expect(CONDITIONS["poisoned"]).toEqual({
      description: "Poisoned",
      checkAdvantage: false,
      attackAdvantage: false
    });
  });

  it("should have correct effects for stunned", () => {
    expect(CONDITIONS["stunned"]).toEqual({
      description: "Stunned",
      checkAdvantage: false,
      attackAdvantage: false,
      saveAdvantage: false,
      canAttack: false
    });
  });
});

describe("getActionSkillCheck", () => {
  it("should map hide action to Stealth (DEX) DC 15", () => {
    const result = getActionSkillCheck("hide");
    expect(result).toEqual({
      skill: "Stealth",
      ability: "dex",
      dc: 15,
      description: "敏捷 (潜行)"
    });
  });

  it("should map stealth keyword to Stealth check", () => {
    const result = getActionSkillCheck("I want to be stealthy");
    expect(result).toEqual({
      skill: "Stealth",
      ability: "dex",
      dc: 15,
      description: "敏捷 (潜行)"
    });
  });

  it("should map sneak keyword to Stealth check", () => {
    const result = getActionSkillCheck("sneak past the guard");
    expect(result).toEqual({
      skill: "Stealth",
      ability: "dex",
      dc: 15,
      description: "敏捷 (潜行)"
    });
  });

  it("should map attack action to Attack roll", () => {
    const result = getActionSkillCheck("attack");
    expect(result).toEqual({
      skill: "Attack",
      ability: "str",
      dc: 0,
      description: "攻击"
    });
  });

  it("should map strike keyword to Attack roll", () => {
    const result = getActionSkillCheck("strike the enemy");
    expect(result).toEqual({
      skill: "Attack",
      ability: "str",
      dc: 0,
      description: "攻击"
    });
  });

  it("should map search action to Perception (WIS) DC 10", () => {
    const result = getActionSkillCheck("search");
    expect(result).toEqual({
      skill: "Perception",
      ability: "wis",
      dc: 10,
      description: "感知 (察觉)"
    });
  });

  it("should map look keyword to Perception check", () => {
    const result = getActionSkillCheck("look around");
    expect(result).toEqual({
      skill: "Perception",
      ability: "wis",
      dc: 10,
      description: "感知 (察觉)"
    });
  });

  it("should map talk action to Persuasion (CHA) DC 10", () => {
    const result = getActionSkillCheck("talk");
    expect(result).toEqual({
      skill: "Persuasion",
      ability: "cha",
      dc: 10,
      description: "魅力 (说服)"
    });
  });

  it("should map persuade keyword to Persuasion check", () => {
    const result = getActionSkillCheck("persuade the merchant");
    expect(result).toEqual({
      skill: "Persuasion",
      ability: "cha",
      dc: 10,
      description: "魅力 (说服)"
    });
  });

  it("should map intimidate action to Intimidation (CHA) DC 12", () => {
    const result = getActionSkillCheck("intimidate");
    expect(result).toEqual({
      skill: "Intimidation",
      ability: "cha",
      dc: 12,
      description: "魅力 (威吓)"
    });
  });

  it("should map investigate action to Investigation (INT) DC 12", () => {
    const result = getActionSkillCheck("investigate");
    expect(result).toEqual({
      skill: "Investigation",
      ability: "int",
      dc: 12,
      description: "智力 (调查)"
    });
  });

  it("should map examine keyword to Investigation check", () => {
    const result = getActionSkillCheck("examine the body");
    expect(result).toEqual({
      skill: "Investigation",
      ability: "int",
      dc: 12,
      description: "智力 (调查)"
    });
  });

  it("should map defend action to Dodge (DEX) with no DC", () => {
    const result = getActionSkillCheck("defend");
    expect(result).toEqual({
      skill: "Dodge",
      ability: "dex",
      dc: 0,
      description: "敏捷 (闪避)"
    });
  });

  it("should map dodge keyword to Dodge check", () => {
    const result = getActionSkillCheck("dodge the attack");
    expect(result).toEqual({
      skill: "Dodge",
      ability: "dex",
      dc: 0,
      description: "敏捷 (闪避)"
    });
  });

  it("should map intelligence action to Arcana (INT) DC 10", () => {
    const result = getActionSkillCheck("intelligence");
    expect(result).toEqual({
      skill: "Arcana",
      ability: "int",
      dc: 10,
      description: "智力 (奥秘)"
    });
  });

  it("should map arcana keyword to Arcana check", () => {
    const result = getActionSkillCheck("identify the magic item");
    expect(result).toEqual({
      skill: "Arcana",
      ability: "int",
      dc: 10,
      description: "智力 (奥秘)"
    });
  });

  it("should map climb action to Athletics (STR) DC 12", () => {
    const result = getActionSkillCheck("climb");
    expect(result).toEqual({
      skill: "Athletics",
      ability: "str",
      dc: 12,
      description: "力量 (运动)"
    });
  });

  it("should map jump keyword to Athletics check", () => {
    const result = getActionSkillCheck("jump over the pit");
    expect(result).toEqual({
      skill: "Athletics",
      ability: "str",
      dc: 12,
      description: "力量 (运动)"
    });
  });

  it("should return null for unknown actions", () => {
    const result = getActionSkillCheck("walk around");
    expect(result).toBeNull();
  });

  it("should return null for free-text actions", () => {
    const result = getActionSkillCheck("I want to explore the corridor");
    expect(result).toBeNull();
  });
});
