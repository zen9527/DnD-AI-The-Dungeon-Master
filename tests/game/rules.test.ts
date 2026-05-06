import { describe, it, expect } from "vitest";
import { getActionSkillCheck, getConditionModifier, applyCondition, removeCondition, CONDITIONS, calculateXPThreshold, checkLevelUp, getLevelUpBenefits, awardXP } from "../../src/game/rules.js";
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
      canAttack: false,
      incapacitated: true
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

// ============================================================================
// XP & LEVELING TESTS — D&D 5e experience and level progression
// ============================================================================

describe("calculateXPThreshold", () => {
  it("should return 0 for level 1", () => {
    expect(calculateXPThreshold(1)).toBe(0);
  });

  it("should return 300 for level 2", () => {
    expect(calculateXPThreshold(2)).toBe(300);
  });

  it("should return 900 for level 3", () => {
    expect(calculateXPThreshold(3)).toBe(900);
  });

  it("should return 6500 for level 5", () => {
    expect(calculateXPThreshold(5)).toBe(6500);
  });

  it("should return 355000 for level 20", () => {
    expect(calculateXPThreshold(20)).toBe(355000);
  });

  it("should return max threshold for level > 20", () => {
    expect(calculateXPThreshold(25)).toBe(355000);
  });
});

describe("checkLevelUp", () => {
  it("should not level up if XP below threshold", () => {
    const result = checkLevelUp(200, 1);
    expect(result.shouldLevelUp).toBe(false);
    expect(result.newLevel).toBe(1);
  });

  it("should level up from 1 to 2 at 300 XP", () => {
    const result = checkLevelUp(300, 1);
    expect(result.shouldLevelUp).toBe(true);
    expect(result.newLevel).toBe(2);
  });

  it("should calculate XP to next level", () => {
    const result = checkLevelUp(500, 2);
    expect(result.xpToNext).toBe(400); // 900 - 500 = 400
  });

  it("should handle multi-level advancement", () => {
    const result = checkLevelUp(6500, 1);
    expect(result.shouldLevelUp).toBe(true);
    expect(result.newLevel).toBe(5);
  });

  it("should return 0 XP to next at level 20", () => {
    const result = checkLevelUp(355000, 20);
    expect(result.xpToNext).toBe(0);
  });
});

describe("getLevelUpBenefits", () => {
  it("should increase HP on level up", () => {
    const benefits = getLevelUpBenefits("Fighter", 2);
    expect(benefits.hpIncrease).toBeGreaterThanOrEqual(5); // Fighter d10 HD, average ~6
    expect(benefits.proficiencyBonus).toBe(2);
  });

  it("should increase proficiency bonus at level 5", () => {
    const benefits = getLevelUpBenefits("Wizard", 5);
    expect(benefits.proficiencyBonus).toBe(3);
  });

  it("should provide spell slots for spellcasters", () => {
    const benefits = getLevelUpBenefits("Wizard", 3);
    expect(benefits.newSpellSlots).toBeDefined();
    expect(benefits.newSpellSlots?.["level-1"]).toBeGreaterThanOrEqual(4);
  });

  it("should not provide spell slots for non-spellcasters", () => {
    const benefits = getLevelUpBenefits("Fighter", 3);
    expect(benefits.newSpellSlots).toBeUndefined();
  });

  it("should provide class features at appropriate levels", () => {
    const benefits = getLevelUpBenefits("Fighter", 5);
    expect(benefits.newFeatures).toContain("Extra Attack");
  });

  it("should return proficiency bonus 4 at level 9", () => {
    const benefits = getLevelUpBenefits("Rogue", 9);
    expect(benefits.proficiencyBonus).toBe(4);
  });
});

describe("awardXP", () => {
  it("should distribute XP to all players", () => {
    const players = [
      { xp: 0, level: 1, characterClass: "Fighter", hp: 10, maxHp: 10, proficiencyBonus: 2, spellSlots: {}, conditions: [], hitDice: { total: 10, used: 0 }, deathSaves: { successes: 0, failures: 0 }, locale: "en-US", id: "1", name: "Test", characterName: "Test", isDM: false, race: "Human", ac: 10, attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, spells: [], inventory: [] } as Player,
      { xp: 0, level: 1, characterClass: "Wizard", hp: 8, maxHp: 8, proficiencyBonus: 2, spellSlots: {}, conditions: [], hitDice: { total: 6, used: 0 }, deathSaves: { successes: 0, failures: 0 }, locale: "en-US", id: "2", name: "Test2", characterName: "Test2", isDM: false, race: "Human", ac: 10, attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, spells: [], inventory: [] } as Player
    ];

    awardXP(players, 100);
    
    expect(players[0].xp).toBe(100);
    expect(players[1].xp).toBe(100);
  });

  it("should trigger level up when XP threshold reached", () => {
    const players = [
      { xp: 250, level: 1, characterClass: "Fighter", hp: 10, maxHp: 10, proficiencyBonus: 2, spellSlots: {}, conditions: [], hitDice: { total: 10, used: 0 }, deathSaves: { successes: 0, failures: 0 }, locale: "en-US", id: "1", name: "Test", characterName: "Test", isDM: false, race: "Human", ac: 10, attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, spells: [], inventory: [] } as Player
    ];

    awardXP(players, 100); // Total: 350, should reach level 2 (threshold 300)
    
    expect(players[0].level).toBe(2);
    expect(players[0].hp).toBeGreaterThan(10); // HP increased
    expect(players[0].maxHp).toBeGreaterThan(10);
  });

  it("should update proficiency bonus on level up", () => {
    const players = [
      { xp: 6400, level: 4, characterClass: "Wizard", hp: 20, maxHp: 20, proficiencyBonus: 2, spellSlots: {}, conditions: [], hitDice: { total: 6, used: 0 }, deathSaves: { successes: 0, failures: 0 }, locale: "en-US", id: "1", name: "Test", characterName: "Test", isDM: false, race: "Human", ac: 10, attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, spells: [], inventory: [] } as Player
    ];

    awardXP(players, 100); // Total: 6500, should reach level 5 (threshold 6500)
    
    expect(players[0].level).toBe(5);
    expect(players[0].proficiencyBonus).toBe(3);
  });
});
