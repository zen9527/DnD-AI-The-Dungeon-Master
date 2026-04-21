import {
  calculateProficiencyBonus,
  calculateModifier,
  calculateHit,
  calculateDamage,
  handleDeath,
  calculateTotal,
} from "./dice.js";
import type { Player, NPC } from "../types/index.js";

export function getAttackBonus(player: Player, weaponAttackBonus: number = 0): number {
  const proficiency = calculateProficiencyBonus(player.level);
  const abilityMod = getAttackAttributeMod(player);
  return proficiency + abilityMod + weaponAttackBonus;
}

export function getAttackAttributeMod(player: Player): number {
  const isSpellcaster = ["Wizard", "Sorcerer", "Cleric", "Paladin", "Ranger"].includes(player.characterClass);
  if (isSpellcaster) return calculateModifier(player.attributes.int);
  return calculateModifier(player.attributes.str);
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

export function calculateAttackDamage(rolls: number[], player: Player, weapon?: { attackBonus?: number }): number {
  const abilityMod = getAttackAttributeMod(player);
  const weaponBonus = weapon?.attackBonus || 0;
  return calculateTotal(rolls, abilityMod + weaponBonus);
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

export function calculateInitiative(dex: number): number {
  return Math.floor(Math.random() * 20) + 1 + calculateModifier(dex);
}
