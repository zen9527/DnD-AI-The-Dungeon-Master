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
});

export const npcSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  role: z.enum(['friendly', 'neutral', 'hostile']),
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

export const unequipItemSchema = z.object({
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

export { scenarioOptions, scenarioDescriptions } from "./scenario.js";
export type { Scenario } from "./scenario.js";
