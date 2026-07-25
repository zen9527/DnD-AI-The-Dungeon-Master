import type { DiceRoll } from "../types/index.js";

export function rollDice(type: number, count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * type) + 1);
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

export function calculateHit(roll: number, attackBonus: number, targetAC: number): { hit: boolean; isCritical: boolean } {
  const total = roll + attackBonus;
  const isCritical = roll === 20;
  const hit = isCritical || total >= targetAC;
  return { hit, isCritical };
}
