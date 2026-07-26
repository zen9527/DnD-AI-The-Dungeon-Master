import { z } from "zod";
import { scenarioOptions, type Scenario } from "./scenario.js";

export const raceOptions = ["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Half-Elf", "Gnome", "Half-Orc"] as const;
export const classOptions = ["Fighter", "Wizard", "Rogue", "Cleric", "Barbarian", "Paladin", "Ranger", "Sorcerer"] as const;

export const createCharacterSchema = z.object({
  race: z.enum(raceOptions),
  characterClass: z.enum(classOptions),
  attributes: z.object({
    str: z.number().int().min(3).max(18),
    dex: z.number().int().min(3).max(18),
    con: z.number().int().min(3).max(18),
    int: z.number().int().min(3).max(18),
    wis: z.number().int().min(3).max(18),
    cha: z.number().int().min(3).max(18),
  }),
});

export const createGameSchema = z.object({
  gameName: z.string().min(1).max(100),
  maxPlayers: z.number().int().min(2).max(8),
  scenario: z.enum(scenarioOptions),
  playerName: z.string().min(1).max(50),
  characterName: z.string().min(1).max(100),
  race: z.enum(raceOptions),
  characterClass: z.enum(classOptions),
  attributes: z.object({
    str: z.number().int().min(3).max(18),
    dex: z.number().int().min(3).max(18),
    con: z.number().int().min(3).max(18),
    int: z.number().int().min(3).max(18),
    wis: z.number().int().min(3).max(18),
    cha: z.number().int().min(3).max(18),
  }),
  locale: z.string().optional(),
});

export const joinGameSchema = z.object({
  gameId: z.string().min(1),
  playerName: z.string().min(1).max(50),
  characterName: z.string().min(1).max(100),
  race: z.enum(raceOptions),
  characterClass: z.enum(classOptions),
  attributes: z.object({
    str: z.number().int().min(3).max(18),
    dex: z.number().int().min(3).max(18),
    con: z.number().int().min(3).max(18),
    int: z.number().int().min(3).max(18),
    wis: z.number().int().min(3).max(18),
    cha: z.number().int().min(3).max(18),
  }),
  locale: z.string().optional(),
});

export const npcSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  role: z.enum(['friendly', 'neutral', 'hostile']),
  // Optional stat block; the engine falls back to defaults when omitted.
  hp: z.number().int().min(0).max(1000).optional(),
  maxHp: z.number().int().min(0).max(1000).optional(),
  ac: z.number().int().min(0).max(30).optional(),
});

export const eventSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
});

export const diceRollSchema = z.object({
  diceType: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12), z.literal(20)]),
  count: z.number().int().min(1).max(10),
  modifier: z.number().optional(),
});

// ============================================================================
// SAVE GAME SCHEMA
// ============================================================================

export const saveGameSchema = z.object({
  gameId: z.string().min(1),
});

/** Reclaiming a seat after a refresh. The token is the only credential. */
export const rejoinGameSchema = z.object({
  gameId: z.string().min(1),
  playerToken: z.string().min(1).max(200),
});

export type RejoinGameInput = z.infer<typeof rejoinGameSchema>;

export type SaveGameInput = z.infer<typeof saveGameSchema>;

// ============================================================================
// INVENTORY & EQUIPMENT SCHEMAS
// ============================================================================

export const itemSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  type: z.enum(["weapon", "armor", "consumable", "misc"]),
  description: z.string().optional(),
  weight: z.number().nonnegative(),
  stats: z.object({
    attackBonus: z.number().optional(),
    damageDice: z.object({ 
      type: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12), z.literal(20)]), 
      count: z.number() 
    }).optional(),
    armorClassBonus: z.number().optional(),
    healingAmount: z.number().optional(), // For potions
  }).optional(),
});

export const equipItemSchema = z.object({
  itemId: z.string(),
  slot: z.enum(["weapon", "armor"]),
});

export const useItemSchema = z.object({
  itemId: z.string(),
  targetId: z.string().optional(), // For potions targeting specific entities
});

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type JoinGameInput = z.infer<typeof joinGameSchema>;
export type CharacterInput = z.infer<typeof createCharacterSchema>;
export type NPCInput = z.infer<typeof npcSchema>;
export type EventInput = z.infer<typeof eventSchema>;
export type DiceRollInput = z.infer<typeof diceRollSchema>;
export type Item = z.infer<typeof itemSchema>;

// ============================================================================
// D&D 5E CONSTANTS — Shared between backend and frontend
// ============================================================================

/** Hit die types by class (D&D 5e standard) */
export const HIT_DIE_BY_CLASS: Record<string, number> = {
  Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10,
  Cleric: 8, Druid: 8, Monk: 8, Rogue: 8,
  Sorcerer: 6, Warlock: 6, Wizard: 6, Bard: 8,
};

/** D&D 5e XP thresholds by level */
export const XP_THRESHOLDS: Record<number, number> = {
  1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500,
  6: 14000, 7: 23000, 8: 34000, 9: 48000, 10: 64000,
  11: 85000, 12: 100000, 13: 120000, 14: 140000, 15: 165000,
  16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000
};

/** Spellcasting ability by class — used for spell save DC and attack attribute */
export const SPELL_ABILITY_MAP: Record<string, string> = {
  Wizard: "int", Sorcerer: "cha", Warlock: "cha",
  Cleric: "wis", Druid: "wis", Bard: "cha",
  Paladin: "cha", Ranger: "wis",
};

// Scenario options and descriptions
export { scenarioOptions, scenarioDescriptions } from "./scenario.js";
export type { Scenario } from "./scenario.js";
