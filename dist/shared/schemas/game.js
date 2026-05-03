import { z } from "zod";
import { scenarioOptions } from "./scenario.js";
export const raceOptions = ["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Half-Elf", "Gnome", "Half-Orc"];
export const classOptions = ["Fighter", "Wizard", "Rogue", "Cleric", "Barbarian", "Paladin", "Ranger", "Sorcerer"];
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
export { scenarioOptions, scenarioDescriptions } from "./scenario.js";
//# sourceMappingURL=game.js.map