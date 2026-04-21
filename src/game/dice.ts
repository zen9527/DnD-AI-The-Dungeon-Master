import { generateId } from "../utils/id.js";
import type { DiceRoll } from "../types/index.js";

export function rollDice(type: number, count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * type) + 1);
}

export function rollWithAdvantage(type: number): number {
  const r1 = Math.floor(Math.random() * type) + 1;
  const r2 = Math.floor(Math.random() * type) + 1;
  return Math.max(r1, r2);
}

export function rollWithDisadvantage(type: number): number {
  const r1 = Math.floor(Math.random() * type) + 1;
  const r2 = Math.floor(Math.random() * type) + 1;
  return Math.min(r1, r2);
}

export function calculateTotal(rolls: number[], modifier: number = 0): number {
  return rolls.reduce((sum, r) => sum + r, 0) + modifier;
}

export function calculateProficiencyBonus(level: number): number {
  if (level <= 4) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  if (level <= 16) return 5;
  return 6;
}

export function calculateModifier(attribute: number): number {
  return Math.floor((attribute - 10) / 2);
}

export function calculateAC(dex: number, armorBonus: number = 0): number {
  return 10 + calculateModifier(dex) + armorBonus;
}

export function calculateHit(roll: number, attackBonus: number, targetAC: number): { hit: boolean; isCritical: boolean } {
  const total = roll + attackBonus;
  const isCritical = roll === 20;
  const hit = isCritical || total >= targetAC;
  return { hit, isCritical };
}

export function calculateDamage(rolls: number[], abilityModifier: number = 0): number {
  return calculateTotal(rolls, abilityModifier);
}

export function handleDeath(currentHp: number, maxHp: number): { dead: boolean; status: string } {
  if (currentHp <= 0) {
    return { dead: true, status: currentHp <= -maxHp ? "dead" : "dropped unconscious" };
  }
  return { dead: false, status: "stable" };
}
