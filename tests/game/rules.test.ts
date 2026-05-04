import { describe, it, expect } from "vitest";
import { getActionSkillCheck } from "../../src/game/rules.js";

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
