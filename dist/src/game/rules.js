import { calculateProficiencyBonus, calculateModifier, calculateHit, handleDeath, calculateTotal, } from "./dice.js";
// ============================================================================
// SKILL CHECKS — D&D 5e Skill → Attribute mapping
// ============================================================================
export const SKILLS = {
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
export const SAVING_THROWS = {
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
export const DC_DIFFICULTY = {
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
export const CLASS_SKILL_PROFICIENCIES = {
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
export const CLASS_SAVING_THROW_PROFICIENCIES = {
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
export function getSkillModifier(player, skill) {
    const attrKey = SKILLS[skill];
    if (!attrKey)
        return calculateModifier(10); // Default to average
    const isProficient = CLASS_SKILL_PROFICIENCIES[player.characterClass]?.includes(skill);
    const proficiency = isProficient ? calculateProficiencyBonus(player.level) : 0;
    return calculateModifier(player.attributes[attrKey]) + proficiency;
}
export function checkSkill(roll, player, skill, dc) {
    const modifier = getSkillModifier(player, skill);
    const total = roll + modifier;
    return { success: total >= dc, total, dc };
}
// ============================================================================
// SAVING THROW — d20 + ability mod vs DC (e.g., fireball save)
// ============================================================================
export function getSavingThrowModifier(player, saveType) {
    const isProficient = CLASS_SAVING_THROW_PROFICIENCIES[player.characterClass]?.includes(saveType.charAt(0).toUpperCase() + saveType.slice(1));
    const proficiency = isProficient ? calculateProficiencyBonus(player.level) : 0;
    return calculateModifier(player.attributes[saveType]) + proficiency;
}
export function checkSavingThrow(roll, player, saveType, dc) {
    const modifier = getSavingThrowModifier(player, saveType);
    const total = roll + modifier;
    return { success: total >= dc, total, dc };
}
// ============================================================================
// PASSIVE SCORES — Used by DM for stealth/perception without rolling
// ============================================================================
export function calculatePassiveScore(player, skill) {
    const attrKey = SKILLS[skill];
    if (!attrKey)
        return 10;
    const isProficient = CLASS_SKILL_PROFICIENCIES[player.characterClass]?.includes(skill);
    const proficiency = isProficient ? calculateProficiencyBonus(player.level) : 0;
    return 10 + calculateModifier(player.attributes[attrKey]) + proficiency;
}
// ============================================================================
// SPELL DC — For spell save DCs (e.g., fireball requires DEX save vs this DC)
// ============================================================================
export function getSpellSaveDC(player) {
    const isSpellcaster = ["Wizard", "Sorcerer", "Cleric", "Paladin", "Ranger"].includes(player.characterClass);
    const spellAbility = isSpellcaster ? player.attributes.int : player.attributes.cha;
    return 8 + calculateModifier(spellAbility) + calculateProficiencyBonus(player.level);
}
// ============================================================================
// DEATH SAVES — D&D 5e death save rules (3 successes = stable, 3 failures = dead)
// ============================================================================
export function rollDeathSave() {
    const roll = Math.floor(Math.random() * 20) + 1;
    return { roll, success: roll >= 10 }; // Natural 20 = instant recovery (handled separately)
}
// ============================================================================
// HIT DICE — Short rest healing mechanic
// ============================================================================
export function getHitDice(player) {
    const defaults = {
        Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10,
        Cleric: 8, Druid: 8, Monk: 8, Rogue: 8,
        Sorcerer: 6, Warlock: 6, Wizard: 6,
    };
    return defaults[player.characterClass] || 8;
}
export function rollHitDice(player) {
    const hd = getHitDice(player);
    const conMod = calculateModifier(player.attributes.con);
    const roll = Math.floor(Math.random() * hd) + 1;
    return { healed: Math.max(1, roll + conMod), conMod };
}
// ============================================================================
// COMBAT — Attack & damage (existing functions preserved below)
// ============================================================================
export function getAttackBonus(player, weaponAttackBonus = 0) {
    const proficiency = calculateProficiencyBonus(player.level);
    const abilityMod = getAttackAttributeMod(player);
    return proficiency + abilityMod + weaponAttackBonus;
}
export function getAttackAttributeMod(player) {
    const isSpellcaster = ["Wizard", "Sorcerer", "Cleric", "Paladin", "Ranger"].includes(player.characterClass);
    if (isSpellcaster)
        return calculateModifier(player.attributes.int);
    return calculateModifier(player.attributes.str);
}
export function isHit(roll, player, target, weaponAttackBonus = 0) {
    const attackBonus = getAttackBonus(player, weaponAttackBonus);
    return calculateHit(roll, attackBonus, target.ac);
}
export function getDamageDice(player, weapon) {
    if (weapon?.damageDice)
        return weapon.damageDice;
    const defaults = {
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
export function calculateAttackDamage(rolls, player, weapon) {
    const abilityMod = getAttackAttributeMod(player);
    const weaponBonus = weapon?.attackBonus || 0;
    return calculateTotal(rolls, abilityMod + weaponBonus);
}
export function checkCreatureDeath(npc, damage) {
    const newHp = Math.max(0, npc.hp - damage);
    const result = handleDeath(newHp - damage, npc.maxHp);
    return {
        npc: { ...npc, hp: newHp },
        defeated: result.dead && newHp === 0,
        status: result.status,
    };
}
export function calculateInitiative(dex) {
    return Math.floor(Math.random() * 20) + 1 + calculateModifier(dex);
}
//# sourceMappingURL=rules.js.map