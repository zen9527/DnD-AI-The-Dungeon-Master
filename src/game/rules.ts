import {
  calculateProficiencyBonus,
  calculateModifier,
  calculateHit,
  calculateTotal,
  rollDice,
} from "./dice.js";
import type { PresetActionId } from "../../shared/schemas/action.js";
import { SPELL_ABILITY_MAP, HIT_DIE_BY_CLASS, XP_THRESHOLDS } from "../../shared/schemas/game.js";
import type { Player, NPC } from "../types/index.js";

// ============================================================================
// SKILL CHECKS — D&D 5e Skill → Attribute mapping
// ============================================================================

export const SKILLS: Record<string, keyof Player['attributes']> = {
  "Acrobatics": "dex",
  "Animal Handling": "wis",
  "Arcana": "int",
  "Athletics": "str",
  "Deception": "cha",
  "History": "int",
  "Insight": "wis",
  "Intimidation": "cha",
  "Investigation": "int",
  "Medicine": "wis",
  "Nature": "int",
  "Perception": "wis",
  "Performance": "cha",
  "Persuasion": "cha",
  "Religion": "int",
  "Sleight of Hand": "dex",
  "Stealth": "dex",
  "Survival": "wis",
};

// ============================================================================
// DC DIFFICULTY — Standard D&D 5e DC table
// ============================================================================

export const DC_DIFFICULTY: Record<string, { dc: number; label: string }> = {
  "veryEasy": { dc: 5, label: "Very Easy" },
  "easy": { dc: 10, label: "Easy" },
  "medium": { dc: 15, label: "Medium" },
  "hard": { dc: 20, label: "Hard" },
  "veryHard": { dc: 25, label: "Very Hard" },
  "nearlyImpossible": { dc: 30, label: "Nearly Impossible" },
};

// ============================================================================
// CLASS PROFICIENCIES — Which skills/classes are proficient in by default
// ============================================================================

export const CLASS_SKILL_PROFICIENCIES: Record<string, string[]> = {
  "Barbarian": ["Athletics", "Intimidation", "Nature", "Perception", "Survival"],
  "Bard": ["Acrobatics", "Deception", "Insight", "Persuasion", "Sleight of Hand", "Performance"],
  "Cleric": ["History", "Insight", "Medicine", "Persuasion", "Religion"],
  "Druid": ["Arcana", "Animal Handling", "Insight", "Medicine", "Nature", "Perception", "Survival"],
  "Fighter": ["Acrobatics", "Athletics", "History", "Intimidation", "Perception", "Survival"],
  "Monk": ["Acrobatics", "Athletics", "Insight", "Religion", "Stealth"],
  "Paladin": ["Athletics", "Insight", "Intimidation", "Medicine", "Persuasion", "Religion"],
  "Ranger": ["Animal Handling", "Athletics", "Insight", "Nature", "Perception", "Survival"],
  "Rogue": ["Acrobatics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Perception", "Performance", "Persuasion", "Sleight of Hand", "Stealth"],
  "Sorcerer": ["Arcana", "Athletics", "Deception", "Insight", "Intimidation", "Persuasion", "Religion"],
  "Warlock": ["Arcana", "History", "Intimidation", "Investigation", "Nature", "Religion"],
  "Wizard": ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"],
};

// ============================================================================
// COMBAT — Attack & damage
// ============================================================================

export function getAttackBonus(player: Player, weaponAttackBonus: number = 0): number {
  const proficiency = calculateProficiencyBonus(player.level);
  // Melee classes use STR; spellcasters use their casting ability
  const spellAbility = SPELL_ABILITY_MAP[player.characterClass];
  const abilityMod = spellAbility ? calculateModifier(player.attributes[spellAbility as keyof Player['attributes']]) : calculateModifier(player.attributes.str);

  let weaponBonus = weaponAttackBonus;
  if (player.equippedWeapon?.stats?.attackBonus) {
    weaponBonus += player.equippedWeapon.stats.attackBonus;
  }

  let buffBonus = 0;
  if (player.buffs) {
    for (const buff of player.buffs) {
      if (buff.bonus) buffBonus += buff.bonus;
    }
  }

  return proficiency + abilityMod + weaponBonus + buffBonus;
}

/**
 * Calculate Armor Class (AC) including armor bonus from equipped armor
 */
export function calculateAC(player: Player): number {
  const base = 10;
  const dexMod = calculateModifier(player.attributes.dex);

  let armorBonus = 0;
  if (player.equippedArmor?.stats?.armorClassBonus) {
    armorBonus = player.equippedArmor.stats.armorClassBonus;
  }

  let buffBonus = 0;
  if (player.buffs) {
    for (const buff of player.buffs) {
      if (buff.effect.toLowerCase().includes('ac') || buff.effect.toLowerCase().includes('defense')) {
        buffBonus += buff.bonus || 0;
      }
    }
  }

  return base + dexMod + armorBonus + buffBonus;
}

export function isHit(roll: number, player: Player, target: NPC, weaponAttackBonus: number = 0): { hit: boolean; isCritical: boolean } {
  const attackBonus = getAttackBonus(player, weaponAttackBonus);
  return calculateHit(roll, attackBonus, target.ac);
}

// ============================================================================
// ACTION TO SKILL CHECK MAPPING — Auto-detect action keywords for dice rolling
// ============================================================================

export interface ActionSkillCheck {
  skill: string;
  ability: keyof Player['attributes'];
  /** Difficulty class; 0 means the action is resolved by the DM, not a flat DC. */
  dc: number;
}

/**
 * Keyword-to-skill table, checked in order so that more specific actions win.
 * Clients localize the result via the `skill.*` keys — this returns the English
 * skill name the rules use, never display text.
 *
 * `presetId` links a row to an action-bar button. That link is what makes the
 * dice work in every language: the text a player sends is localized ("我攻击我的
 * 目标"), so keyword matching alone only ever fires for English.
 */
const ACTION_SKILL_CHECKS: Array<{ keywords: string[]; presetId?: PresetActionId } & ActionSkillCheck> = [
  { keywords: ["defend", "dodge", "protect"],        presetId: "defend", skill: "Dodge",         ability: "dex", dc: 0 },
  { keywords: ["hide", "stealth", "sneak"],          presetId: "hide",   skill: "Stealth",       ability: "dex", dc: 15 },
  { keywords: ["attack", "strike", "hit"],           presetId: "attack", skill: "Attack",        ability: "str", dc: 0 },
  { keywords: ["search", "look", "perceive"],        presetId: "search", skill: "Perception",    ability: "wis", dc: 10 },
  { keywords: ["talk", "persuade", "convince"],      presetId: "talk",   skill: "Persuasion",    ability: "cha", dc: 10 },
  { keywords: ["intimidate", "threaten"],                                skill: "Intimidation",  ability: "cha", dc: 12 },
  { keywords: ["investigate", "examine", "inspect"],                     skill: "Investigation", ability: "int", dc: 12 },
  { keywords: ["intelligence", "arcana", "magic"],   presetId: "arcana", skill: "Arcana",        ability: "int", dc: 10 },
  { keywords: ["climb", "jump", "swim"],                                 skill: "Athletics",     ability: "str", dc: 12 },
];

/**
 * Decide which skill check an action calls for.
 *
 * A preset button supplies `presetId` and matches exactly. Free text falls back
 * to English keyword matching, which is best-effort — a player typing in
 * another language gets no automatic check, and the DM narrates the outcome.
 */
export function getActionSkillCheck(action: string, presetId?: PresetActionId): ActionSkillCheck | null {
  if (presetId) {
    const preset = ACTION_SKILL_CHECKS.find(entry => entry.presetId === presetId);
    if (preset) return { skill: preset.skill, ability: preset.ability, dc: preset.dc };
  }

  const actionLower = action.toLowerCase();
  for (const { keywords, skill, ability, dc } of ACTION_SKILL_CHECKS) {
    if (keywords.some(keyword => actionLower.includes(keyword))) {
      return { skill, ability, dc };
    }
  }

  return null;
}

// ============================================================================
// CONDITIONS — D&D 5e Condition Tracking System
// ============================================================================

export const CONDITIONS: Record<string, {
  description: string;
  attackAdvantage?: boolean;
  checkAdvantage?: boolean;
  saveAdvantage?: boolean;
  speedZero?: boolean;
  canAttack?: boolean;
  incapacitated?: boolean;
}> = {
  "blinded": { description: "Blinded", checkAdvantage: false, attackAdvantage: false, saveAdvantage: true },
  "charmed": { description: "Charmed", canAttack: false },
  "deafened": { description: "Deafened", checkAdvantage: false },
  "exhaustion": { description: "Exhaustion", checkAdvantage: false, speedZero: true },
  "frightened": { description: "Frightened", checkAdvantage: false, attackAdvantage: false },
  "grappled": { description: "Grappled", speedZero: true },
  "incapacitated": { description: "Incapacitated", canAttack: false, incapacitated: true },
  "invisible": { description: "Invisible", attackAdvantage: false },
  "paralyzed": { description: "Paralyzed", canAttack: false, incapacitated: true, speedZero: true },
  "petrified": { description: "Petrified", speedZero: true, incapacitated: true },
  "poisoned": { description: "Poisoned", checkAdvantage: false, attackAdvantage: false },
  "prone": { description: "Prone", speedZero: true },
  "restrained": { description: "Restrained", checkAdvantage: false, attackAdvantage: false },
  "stunned": { description: "Stunned", checkAdvantage: false, attackAdvantage: false, canAttack: false, incapacitated: true },
  "unconscious": { description: "Unconscious", canAttack: false, incapacitated: true, speedZero: true },
};

// ============================================================================
// COMBINED SKILL CHECK — Multiple players helping on one check (+2 per helper)
// ============================================================================

export function calculateCombinedCheck(
  mainRoll: number,
  mainModifier: number,
  helpers: number,
  allHelpersProficient: boolean = true
): { total: number; mainTotal: number; helperBonus: number; dc: number; success: boolean } {
  const mainTotal = mainRoll + mainModifier;
  const helperBonus = allHelpersProficient ? helpers * 2 : 0;
  const total = mainTotal + helperBonus;

  return { total, mainTotal, helperBonus, dc: 15, success: total >= 15 };
}

// ============================================================================
// XP & LEVELING — D&D 5e experience and level progression
// ============================================================================

export function calculateXPThreshold(level: number): number {
  const threshold = XP_THRESHOLDS[level];
  return threshold !== undefined ? threshold : 355000;
}

export function checkLevelUp(xp: number, currentLevel: number): {
  shouldLevelUp: boolean;
  newLevel: number;
  xpToNext: number;
} {
  let newLevel = currentLevel;
  while (newLevel < 20 && xp >= calculateXPThreshold(newLevel + 1)) {
    newLevel++;
  }

  const shouldLevelUp = newLevel > currentLevel;
  const xpToNext = newLevel < 20 ? calculateXPThreshold(newLevel + 1) - xp : 0;

  return { shouldLevelUp, newLevel, xpToNext };
}

export function getLevelUpBenefits(characterClass: string, newLevel: number): {
  hpIncrease: number;
  proficiencyBonus: number;
  newSpellSlots?: Record<string, number>;
  newFeatures?: string[];
} {
  const hd = HIT_DIE_BY_CLASS[characterClass] || 8;
  const conMod = 0;
  const hpIncrease = Math.floor((hd + 1) / 2) + conMod;

  const proficiencyBonus = calculateProficiencyBonus(newLevel);

  const benefits: { hpIncrease: number; proficiencyBonus: number; newSpellSlots?: Record<string, number>; newFeatures?: string[] } = { hpIncrease, proficiencyBonus };

  if (["Wizard", "Sorcerer", "Cleric", "Paladin", "Ranger", "Bard", "Warlock"].includes(characterClass)) {
    benefits.newSpellSlots = calculateNewSpellSlots(newLevel);
  }

  benefits.newFeatures = getClassFeaturesAtLevel(characterClass, newLevel);

  return benefits;
}

function calculateNewSpellSlots(level: number): Record<string, number> {
  const slots: Record<string, number> = {};
  if (level >= 1) slots["level-1"] = 2;
  if (level >= 2) slots["level-1"] = 3;
  if (level >= 3) { slots["level-1"] = 4; slots["level-2"] = 2; }
  if (level >= 5) { slots["level-1"] = 4; slots["level-2"] = 3; slots["level-3"] = 2; }
  if (level >= 7) { slots["level-1"] = 4; slots["level-2"] = 3; slots["level-3"] = 3; slots["level-4"] = 1; }
  if (level >= 9) { slots["level-1"] = 4; slots["level-2"] = 3; slots["level-3"] = 3; slots["level-4"] = 2; slots["level-5"] = 1; }
  return slots;
}

function getClassFeaturesAtLevel(characterClass: string, level: number): string[] {
  const features: string[] = [];
  if (characterClass === "Fighter") {
    if (level === 2) features.push("Second Wind");
    if (level === 3) features.push("Fighting Style");
    if (level === 5) features.push("Extra Attack");
  }
  if (characterClass === "Rogue") {
    if (level === 2) features.push("Cunning Action");
    if (level === 3) features.push("Roguish Archetype");
    if (level === 5) features.push("Uncanny Dodge");
  }
  if (characterClass === "Wizard") {
    if (level === 2) features.push("Arcane Recovery");
    if (level === 3) features.push("Arcane Tradition");
  }
  return features;
}

export function awardXP(players: Player[], xpAmount: number): void {
  for (const player of players) {
    player.xp += xpAmount;
    const levelUp = checkLevelUp(player.xp, player.level);
    if (levelUp.shouldLevelUp) {
      const benefits = getLevelUpBenefits(player.characterClass, levelUp.newLevel);
      player.level = levelUp.newLevel;
      player.hp += benefits.hpIncrease;
      player.maxHp += benefits.hpIncrease;
      player.proficiencyBonus = benefits.proficiencyBonus;
      if (benefits.newSpellSlots) {
        for (const [key, val] of Object.entries(benefits.newSpellSlots)) {
          player.spellSlots[key] = val;
        }
      }
      console.log(`[LevelUp] ${player.characterName} reached level ${levelUp.newLevel}!`);
    }
  }
}

// ============================================================================
// HIT DICE & INITIATIVE
// ============================================================================

function getHitDice(player: Player): number {
  return HIT_DIE_BY_CLASS[player.characterClass] || 8;
}

export function rollHitDice(player: Player): { healed: number; conMod: number } {
  const hd = getHitDice(player);
  const conMod = calculateModifier(player.attributes.con);
  const roll = Math.floor(Math.random() * hd) + 1;
  return { healed: Math.max(1, roll + conMod), conMod };
}

/**
 * Calculate initiative score: d20 + Dexterity modifier
 */
export function calculateInitiative(dexterity: number): number {
  const dexMod = calculateModifier(dexterity);
  const d20Roll = rollDice(20, 1)[0];
  return d20Roll + dexMod;
}

/**
 * Build initiative order from players and NPCs
 */
export function buildInitiativeOrder(players: Player[], npcs: NPC[]): { playerId?: string; npcId?: string; score: number }[] {
  const initiative: { playerId?: string; npcId?: string; score: number }[] = [];

  for (const player of players) {
    initiative.push({ playerId: player.id, score: player.initiative || calculateInitiative(player.attributes.dex) });
  }
  for (const npc of npcs) {
    initiative.push({ npcId: npc.id, score: npc.initiative || calculateInitiative(npc.attributes.dex) });
  }

  initiative.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Math.random() - 0.5;
  });

  return initiative;
}
