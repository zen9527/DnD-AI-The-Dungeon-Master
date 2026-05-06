import {
  calculateProficiencyBonus,
  calculateModifier,
  calculateHit,
  calculateDamage,
  handleDeath,
  calculateTotal,
  rollDice,
} from "./dice.js";
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
// SAVING THROWS — All 6 attributes can be saving throws
// ============================================================================

export const SAVING_THROWS: Record<string, keyof Player['attributes']> = {
  "Strength": "str",
  "Dexterity": "dex",
  "Constitution": "con",
  "Intelligence": "int",
  "Wisdom": "wis",
  "Charisma": "cha",
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

export const CLASS_SAVING_THROW_PROFICIENCIES: Record<string, string[]> = {
  "Barbarian": ["Strength", "Constitution"],
  "Bard": ["Dexterity", "Charisma"],
  "Cleric": ["Wisdom", "Charisma"],
  "Druid": ["Intelligence", "Wisdom"],
  "Fighter": ["Strength", "Constitution"],
  "Monk": ["Strength", "Dexterity"],
  "Paladin": ["Wisdom", "Charisma"],
  "Ranger": ["Strength", "Dexterity"],
  "Rogue": ["Dexterity", "Intelligence"],
  "Sorcerer": ["Constitution", "Charisma"],
  "Warlock": ["Wisdom", "Charisma"],
  "Wizard": ["Intelligence", "Wisdom"],
};

// ============================================================================
// SKILL CHECK — d20 + modifier vs DC
// ============================================================================

export function getSkillModifier(player: Player, skill: string): number {
  const attrKey = SKILLS[skill];
  if (!attrKey) return calculateModifier(10); // Default to average
  const isProficient = CLASS_SKILL_PROFICIENCIES[player.characterClass]?.includes(skill);
  const proficiency = isProficient ? calculateProficiencyBonus(player.level) : 0;
  return calculateModifier(player.attributes[attrKey]) + proficiency;
}

export function checkSkill(roll: number, player: Player, skill: string, dc: number): { success: boolean; total: number; dc: number } {
  const modifier = getSkillModifier(player, skill);
  const total = roll + modifier;
  return { success: total >= dc, total, dc };
}

// ============================================================================
// SAVING THROW — d20 + ability mod vs DC (e.g., fireball save)
// ============================================================================

export function getSavingThrowModifier(player: Player, saveType: keyof Player['attributes']): number {
  const isProficient = CLASS_SAVING_THROW_PROFICIENCIES[player.characterClass]?.includes(saveType.charAt(0).toUpperCase() + saveType.slice(1));
  const proficiency = isProficient ? calculateProficiencyBonus(player.level) : 0;
  return calculateModifier(player.attributes[saveType]) + proficiency;
}

export function checkSavingThrow(roll: number, player: Player, saveType: keyof Player['attributes'], dc: number): { success: boolean; total: number; dc: number } {
  const modifier = getSavingThrowModifier(player, saveType);
  const total = roll + modifier;
  return { success: total >= dc, total, dc };
}

// ============================================================================
// PASSIVE SCORES — Used by DM for stealth/perception without rolling
// ============================================================================

export function calculatePassiveScore(player: Player, skill: string): number {
  const attrKey = SKILLS[skill];
  if (!attrKey) return 10;
  const isProficient = CLASS_SKILL_PROFICIENCIES[player.characterClass]?.includes(skill);
  const proficiency = isProficient ? calculateProficiencyBonus(player.level) : 0;
  return 10 + calculateModifier(player.attributes[attrKey]) + proficiency;
}

// ============================================================================
// SPELL DC — For spell save DCs (e.g., fireball requires DEX save vs this DC)
// ============================================================================

export function getSpellSaveDC(player: Player): number {
  const isSpellcaster = ["Wizard", "Sorcerer", "Cleric", "Paladin", "Ranger"].includes(player.characterClass);
  const spellAbility = isSpellcaster ? player.attributes.int : player.attributes.cha;
  return 8 + calculateModifier(spellAbility) + calculateProficiencyBonus(player.level);
}

// ============================================================================
// DEATH SAVES — D&D 5e death save rules (3 successes = stable, 3 failures = dead)
// ============================================================================

export function rollDeathSave(): { roll: number; success: boolean } {
  const roll = Math.floor(Math.random() * 20) + 1;
  return { roll, success: roll >= 10 }; // Natural 20 = instant recovery (handled separately)
}

// ============================================================================
// HIT DICE — Short rest healing mechanic
// ============================================================================

export function getHitDice(player: Player): number {
  const defaults: Record<string, number> = {
    Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10,
    Cleric: 8, Druid: 8, Monk: 8, Rogue: 8,
    Sorcerer: 6, Warlock: 6, Wizard: 6,
  };
  return defaults[player.characterClass] || 8;
}

export function rollHitDice(player: Player): { healed: number; conMod: number } {
  const hd = getHitDice(player);
  const conMod = calculateModifier(player.attributes.con);
  const roll = Math.floor(Math.random() * hd) + 1;
  return { healed: Math.max(1, roll + conMod), conMod };
}

// ============================================================================
// COMBAT — Attack & damage (existing functions preserved below)
// ============================================================================

export function getAttackBonus(player: Player, weaponAttackBonus: number = 0): number {
  const proficiency = calculateProficiencyBonus(player.level);
  const abilityMod = getAttackAttributeMod(player);
  
  // Add weapon attack bonus from equipped weapon if present
  let weaponBonus = weaponAttackBonus;
  if (player.equippedWeapon?.stats?.attackBonus) {
    weaponBonus += player.equippedWeapon.stats.attackBonus;
  }
  
  // Add buff bonuses (e.g., bless spell gives +1d4, simplified to +2 here)
  let buffBonus = 0;
  if (player.buffs) {
    for (const buff of player.buffs) {
      if (buff.bonus) {
        buffBonus += buff.bonus;
      }
    }
  }
  
  return proficiency + abilityMod + weaponBonus + buffBonus;
}

export function getAttackAttributeMod(player: Player): number {
  const isSpellcaster = ["Wizard", "Sorcerer", "Cleric", "Paladin", "Ranger"].includes(player.characterClass);
  if (isSpellcaster) return calculateModifier(player.attributes.int);
  return calculateModifier(player.attributes.str);
}

/**
 * Calculate Armor Class (AC) including armor bonus from equipped armor
 * Formula: Base 10 + Dexterity modifier + Armor AC bonus (if equipped)
 */
export function calculateAC(player: Player): number {
  const base = 10;
  const dexMod = calculateModifier(player.attributes.dex);
  
  // Add armor bonus if armor is equipped
  let armorBonus = 0;
  if (player.equippedArmor?.stats?.armorClassBonus) {
    armorBonus = player.equippedArmor.stats.armorClassBonus;
  }
  
  // Add buff bonuses to AC (e.g., shield spell gives +5 AC)
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

export function getDamageDice(player: Player, weapon?: { damageDice?: { type: number; count: number } }): { type: number; count: number } {
  if (weapon?.damageDice) return weapon.damageDice;
  const defaults: Record<string, { type: number; count: number }> = {
    Fighter: { type: 8, count: 1 },
    Barbarian: { type: 12, count: 1 },
    Rogue: { type: 6, count: 1 },
    Wizard: { type: 4, count: 1 },
    Cleric: { type: 6, count: 1 },
    Paladin: { type: 8, count: 1 },
    Ranger: { type: 8, count: 1 },
    Sorcerer: { type: 4, count: 1 },
  };
  return defaults[player.characterClass] || { type: 6, count: 1 };
}

export function checkCreatureDeath(npc: NPC, damage: number): { npc: NPC; defeated: boolean; status: string } {
  const newHp = Math.max(0, npc.hp - damage);
  const result = handleDeath(newHp - damage, npc.maxHp);
  return {
    npc: { ...npc, hp: newHp },
    defeated: result.dead && newHp === 0,
    status: result.status,
  };
}

// ============================================================================
// ACTION TO SKILL CHECK MAPPING — Auto-detect action keywords for dice rolling
// ============================================================================

export function getActionSkillCheck(action: string): {
  skill: string;
  ability: keyof Player['attributes'];
  dc: number;
  description: string; // Localized description (en-US default)
} | null {
  const actionLower = action.toLowerCase();

  // Defend / Dodge (check before attack to avoid "dodge the attack" matching attack)
  if (actionLower.includes("defend") || actionLower.includes("dodge") || actionLower.includes("protect")) {
    return {
      skill: "Dodge",
      ability: "dex",
      dc: 0, // Defensive action, no check needed
      description: "敏捷 (闪避)"
    };
  }

  // Stealth / Hide
  if (actionLower.includes("hide") || actionLower.includes("stealth") || actionLower.includes("sneak")) {
    return {
      skill: "Stealth",
      ability: "dex",
      dc: 15,
      description: "敏捷 (潜行)"
    };
  }

  // Attack
  if (actionLower.includes("attack") || actionLower.includes("strike") || actionLower.includes("hit")) {
    return {
      skill: "Attack",
      ability: "str", // Default to STR, DM can narrate DEX for finesse weapons
      dc: 0, // Attack rolls compare to AC, not DC
      description: "攻击"
    };
  }

  // Search / Perception
  if (actionLower.includes("search") || actionLower.includes("look") || actionLower.includes("perceive")) {
    return {
      skill: "Perception",
      ability: "wis",
      dc: 10,
      description: "感知 (察觉)"
    };
  }

  // Talk / Persuasion
  if (actionLower.includes("talk") || actionLower.includes("persuade") || actionLower.includes("convince")) {
    return {
      skill: "Persuasion",
      ability: "cha",
      dc: 10,
      description: "魅力 (说服)"
    };
  }

  // Intimidation
  if (actionLower.includes("intimidate") || actionLower.includes("threaten")) {
    return {
      skill: "Intimidation",
      ability: "cha",
      dc: 12,
      description: "魅力 (威吓)"
    };
  }

  // Investigation
  if (actionLower.includes("investigate") || actionLower.includes("examine") || actionLower.includes("inspect")) {
    return {
      skill: "Investigation",
      ability: "int",
      dc: 12,
      description: "智力 (调查)"
    };
  }

  // Intelligence / Arcana
  if (actionLower.includes("intelligence") || actionLower.includes("arcana") || actionLower.includes("magic")) {
    return {
      skill: "Arcana",
      ability: "int",
      dc: 10,
      description: "智力 (奥秘)"
    };
  }

  // Athletics
  if (actionLower.includes("climb") || actionLower.includes("jump") || actionLower.includes("swim")) {
    return {
      skill: "Athletics",
      ability: "str",
      dc: 12,
      description: "力量 (运动)"
    };
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
): {
  attackAdvantage?: boolean;
  checkAdvantage?: boolean;
  saveAdvantage?: boolean;
} {
  const result: { attackAdvantage?: boolean; checkAdvantage?: boolean; saveAdvantage?: boolean } = {};

  // Apply self conditions (disadvantages/advantages)
  for (const cond of selfConditions) {
    const effect = CONDITIONS[cond];
    if (!effect) continue;
    if (effect.attackAdvantage !== undefined) result.attackAdvantage = effect.attackAdvantage;
    if (effect.checkAdvantage !== undefined) result.checkAdvantage = effect.checkAdvantage;
    if (effect.saveAdvantage !== undefined) result.saveAdvantage = effect.saveAdvantage;
  }

  // Apply target conditions (affects attacker's advantage when targeting them)
  for (const cond of targetConditions) {
    const effect = CONDITIONS[cond];
    if (!effect) continue;
    if (cond === "prone") result.attackAdvantage = true; // Attacking prone target = advantage
    if (cond === "invisible") result.attackAdvantage = false; // Invisible target = disadvantage to attack
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
): {
  total: number;
  mainTotal: number;
  helperBonus: number;
  dc: number;
  success: boolean;
} {
  const mainTotal = mainRoll + mainModifier;
  const helperBonus = allHelpersProficient ? helpers * 2 : 0;
  const total = mainTotal + helperBonus;
  
  return {
    total,
    mainTotal,
    helperBonus,
    dc: 15,
    success: total >= 15
  };
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
  
  if (helpers === 0) {
    return `${skill} ${verb}: ${result}`;
  }
  
  return `${skill} ${verb} (with ${helpers} helper${helpers > 1 ? "s" : ""}): ${result}`;
}

// ============================================================================
// XP & LEVELING — D&D 5e experience and level progression
// ============================================================================

export const XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000
};

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
   // Hit die types by class (D&D 5e standard)
   const hitDieByClass: Record<string, number> = {
     Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10,
     Cleric: 8, Druid: 8, Monk: 8, Rogue: 8,
     Sorcerer: 6, Warlock: 6, Wizard: 6, Bard: 8,
   };
   const hd = hitDieByClass[characterClass] || 8;
   const conMod = 0; // Will be applied with actual CON mod
   const hpIncrease = Math.floor((hd + 1) / 2) + conMod; // Average + 1
   
   let proficiencyBonus = 2;
   if (newLevel >= 5) proficiencyBonus = 3;
   if (newLevel >= 9) proficiencyBonus = 4;
   if (newLevel >= 13) proficiencyBonus = 5;
   if (newLevel >= 17) proficiencyBonus = 6;
   
   const benefits: {
     hpIncrease: number;
     proficiencyBonus: number;
     newSpellSlots?: Record<string, number>;
     newFeatures?: string[];
   } = { hpIncrease, proficiencyBonus };

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
// COMBAT MECHANICS — Initiative, Attack Resolution, Damage
// ============================================================================

/**
 * Calculate initiative score: d20 + Dexterity modifier
 */
export function calculateInitiative(dexterity: number): number {
  const dexMod = calculateModifier(dexterity);
  const d20Roll = rollDice(20, 1)[0];
  return d20Roll + dexMod;
}

/**
 * Check if an attack hits the target's AC
 */
export function checkAttackHit(attackerBonus: number, targetAC: number): { hit: boolean; isCritical: boolean } {
  const d20Roll = rollDice(20, 1)[0];
  const total = d20Roll + attackerBonus;
  
  // Natural 20 = critical hit
  if (d20Roll === 20) {
    return { hit: true, isCritical: true };
  }
  
  // Natural 1 = automatic miss
  if (d20Roll === 1) {
    return { hit: false, isCritical: false };
  }
  
  return { hit: total >= targetAC, isCritical: false };
}

/**
 * Calculate attack damage with dice rolls
 */
export function calculateAttackDamage(damageDice: { type: number; count: number; modifier?: number }): number {
  const rolls = rollDice(damageDice.type as any, damageDice.count);
  const total = calculateTotal(rolls, damageDice.modifier || 0);
  return total;
}

/**
 * Apply damage to a creature, considering temporary HP
 */
export function applyDamage(creature: { hp: number; maxHp: number; temporaryHp?: number }, damage: number): { 
  damageDealt: number; 
  temporaryHpRemaining?: number;
  isDefeated: boolean;
} {
  let tempHp = creature.temporaryHp || 0;
  
  // Temporary HP absorbs damage first
  if (tempHp > 0) {
    if (damage <= tempHp) {
      tempHp -= damage;
      return { 
        damageDealt: 0, 
        temporaryHpRemaining: tempHp,
        isDefeated: false 
      };
    } else {
      damage -= tempHp;
      tempHp = 0;
    }
  }
  
  // Remaining damage goes to actual HP
  const newHp = creature.hp - damage;
  return {
    damageDealt: damage,
    temporaryHpRemaining: 0,
    isDefeated: newHp <= 0
  };
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

  // Sort by initiative (descending), ties broken by random
  initiative.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Math.random() - 0.5;
  });

  return initiative;
}

/**
 * Apply temporary HP to a creature
 */
export function applyTemporaryHP(creature: { temporaryHp?: number }, newTempHp: number): number {
  const currentTempHp = creature.temporaryHp || 0;
  // New temp HP replaces old if higher
  creature.temporaryHp = Math.max(currentTempHp, newTempHp);
  return creature.temporaryHp;
}


