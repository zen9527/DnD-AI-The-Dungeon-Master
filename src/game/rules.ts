import {
  calculateProficiencyBonus,
  calculateModifier,
  calculateHit,
  handleDeath,
  calculateTotal,
  rollDice,
} from "./dice.js";
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

export function getActionSkillCheck(action: string): {
  skill: string;
  ability: keyof Player['attributes'];
  dc: number;
  description: string;
} | null {
  const actionLower = action.toLowerCase();

  if (actionLower.includes("defend") || actionLower.includes("dodge") || actionLower.includes("protect")) {
    return { skill: "Dodge", ability: "dex", dc: 0, description: "敏捷 (闪避)" };
  }
  if (actionLower.includes("hide") || actionLower.includes("stealth") || actionLower.includes("sneak")) {
    return { skill: "Stealth", ability: "dex", dc: 15, description: "敏捷 (潜行)" };
  }
  if (actionLower.includes("attack") || actionLower.includes("strike") || actionLower.includes("hit")) {
    return { skill: "Attack", ability: "str", dc: 0, description: "攻击" };
  }
  if (actionLower.includes("search") || actionLower.includes("look") || actionLower.includes("perceive")) {
    return { skill: "Perception", ability: "wis", dc: 10, description: "感知 (察觉)" };
  }
  if (actionLower.includes("talk") || actionLower.includes("persuade") || actionLower.includes("convince")) {
    return { skill: "Persuasion", ability: "cha", dc: 10, description: "魅力 (说服)" };
  }
  if (actionLower.includes("intimidate") || actionLower.includes("threaten")) {
    return { skill: "Intimidation", ability: "cha", dc: 12, description: "魅力 (威吓)" };
  }
  if (actionLower.includes("investigate") || actionLower.includes("examine") || actionLower.includes("inspect")) {
    return { skill: "Investigation", ability: "int", dc: 12, description: "智力 (调查)" };
  }
  if (actionLower.includes("intelligence") || actionLower.includes("arcana") || actionLower.includes("magic")) {
    return { skill: "Arcana", ability: "int", dc: 10, description: "智力 (奥秘)" };
  }
  if (actionLower.includes("climb") || actionLower.includes("jump") || actionLower.includes("swim")) {
    return { skill: "Athletics", ability: "str", dc: 12, description: "力量 (运动)" };
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

export function getConditionModifier(
  selfConditions: string[],
  targetConditions: string[] = []
): { attackAdvantage?: boolean; checkAdvantage?: boolean; saveAdvantage?: boolean } {
  const result: { attackAdvantage?: boolean; checkAdvantage?: boolean; saveAdvantage?: boolean } = {};

  for (const cond of selfConditions) {
    const effect = CONDITIONS[cond];
    if (!effect) continue;
    if (effect.attackAdvantage !== undefined) result.attackAdvantage = effect.attackAdvantage;
    if (effect.checkAdvantage !== undefined) result.checkAdvantage = effect.checkAdvantage;
    if (effect.saveAdvantage !== undefined) result.saveAdvantage = effect.saveAdvantage;
  }

  for (const cond of targetConditions) {
    const effect = CONDITIONS[cond];
    if (!effect) continue;
    if (cond === "prone") result.attackAdvantage = true;
    if (cond === "invisible") result.attackAdvantage = false;
  }

  return result;
}

export function applyCondition(player: Player, condition: string): void {
  if (!CONDITIONS[condition]) {
    console.warn(`Unknown condition: ${condition}`);
    return;
  }
  if (!player.conditions.includes(condition)) {
    player.conditions.push(condition);
  }
}

export function removeCondition(player: Player, condition: string): void {
  player.conditions = player.conditions.filter(c => c !== condition);
}

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

export function getCombinedCheckDescription(
  skill: string,
  helpers: number,
  success: boolean,
  locale: string
): string {
  const verb = locale === "zh-CN" ? "检定" : "check";
  const result = success
    ? (locale === "zh-CN" ? "成功" : "SUCCESS")
    : (locale === "zh-CN" ? "失败" : "FAILURE");

  if (helpers === 0) return `${skill} ${verb}: ${result}`;
  return `${skill} ${verb} (with ${helpers} helper${helpers > 1 ? "s" : ""}): ${result}`;
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

export function getHitDice(player: Player): number {
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
