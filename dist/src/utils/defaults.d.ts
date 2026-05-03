import type { Attributes } from "../types/index.js";
import type { Scenario } from "../../shared/schemas/scenario.js";
/**
 * Generate default attributes based on class and race.
 * Uses 3-18 range per D&D rules, with bonuses applied to base 10 stats.
 */
export declare function generateDefaultAttributes(characterClass: string, race: string): Attributes;
/**
 * Default scenario descriptions and starting locations.
 */
export declare const SCENARIO_DEFAULTS: Record<Scenario, {
    label: string;
    description: string;
    startingLocation: string;
}>;
/**
 * Generate default character name based on class and race.
 */
export declare function generateDefaultCharacterName(characterClass: string, race: string): string;
/**
 * Default starting inventory based on class.
 */
export declare function generateDefaultInventory(characterClass: string): Array<{
    name: string;
    type: 'weapon' | 'armor' | 'potion' | 'misc';
    description: string;
}>;
//# sourceMappingURL=defaults.d.ts.map