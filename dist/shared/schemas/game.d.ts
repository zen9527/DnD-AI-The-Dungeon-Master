import { z } from "zod";
export declare const raceOptions: readonly ["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Half-Elf", "Gnome", "Half-Orc"];
export declare const classOptions: readonly ["Fighter", "Wizard", "Rogue", "Cleric", "Barbarian", "Paladin", "Ranger", "Sorcerer"];
export declare const createCharacterSchema: z.ZodObject<{
    race: z.ZodEnum<["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Half-Elf", "Gnome", "Half-Orc"]>;
    characterClass: z.ZodEnum<["Fighter", "Wizard", "Rogue", "Cleric", "Barbarian", "Paladin", "Ranger", "Sorcerer"]>;
    attributes: z.ZodObject<{
        str: z.ZodNumber;
        dex: z.ZodNumber;
        con: z.ZodNumber;
        int: z.ZodNumber;
        wis: z.ZodNumber;
        cha: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    }, {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    }>;
}, "strip", z.ZodTypeAny, {
    race: "Human" | "Elf" | "Dwarf" | "Halfling" | "Dragonborn" | "Half-Elf" | "Gnome" | "Half-Orc";
    characterClass: "Fighter" | "Wizard" | "Rogue" | "Cleric" | "Barbarian" | "Paladin" | "Ranger" | "Sorcerer";
    attributes: {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    };
}, {
    race: "Human" | "Elf" | "Dwarf" | "Halfling" | "Dragonborn" | "Half-Elf" | "Gnome" | "Half-Orc";
    characterClass: "Fighter" | "Wizard" | "Rogue" | "Cleric" | "Barbarian" | "Paladin" | "Ranger" | "Sorcerer";
    attributes: {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    };
}>;
export declare const createGameSchema: z.ZodObject<{
    gameName: z.ZodString;
    maxPlayers: z.ZodNumber;
    scenario: z.ZodEnum<["dungeon", "wilderness", "intrigue", "horror", "epic", "sea"]>;
    playerName: z.ZodString;
    characterName: z.ZodString;
    race: z.ZodEnum<["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Half-Elf", "Gnome", "Half-Orc"]>;
    characterClass: z.ZodEnum<["Fighter", "Wizard", "Rogue", "Cleric", "Barbarian", "Paladin", "Ranger", "Sorcerer"]>;
    attributes: z.ZodObject<{
        str: z.ZodNumber;
        dex: z.ZodNumber;
        con: z.ZodNumber;
        int: z.ZodNumber;
        wis: z.ZodNumber;
        cha: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    }, {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    }>;
}, "strip", z.ZodTypeAny, {
    race: "Human" | "Elf" | "Dwarf" | "Halfling" | "Dragonborn" | "Half-Elf" | "Gnome" | "Half-Orc";
    characterClass: "Fighter" | "Wizard" | "Rogue" | "Cleric" | "Barbarian" | "Paladin" | "Ranger" | "Sorcerer";
    attributes: {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    };
    gameName: string;
    maxPlayers: number;
    scenario: "dungeon" | "wilderness" | "intrigue" | "horror" | "epic" | "sea";
    playerName: string;
    characterName: string;
}, {
    race: "Human" | "Elf" | "Dwarf" | "Halfling" | "Dragonborn" | "Half-Elf" | "Gnome" | "Half-Orc";
    characterClass: "Fighter" | "Wizard" | "Rogue" | "Cleric" | "Barbarian" | "Paladin" | "Ranger" | "Sorcerer";
    attributes: {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    };
    gameName: string;
    maxPlayers: number;
    scenario: "dungeon" | "wilderness" | "intrigue" | "horror" | "epic" | "sea";
    playerName: string;
    characterName: string;
}>;
export declare const joinGameSchema: z.ZodObject<{
    gameId: z.ZodString;
    playerName: z.ZodString;
    characterName: z.ZodString;
    race: z.ZodEnum<["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Half-Elf", "Gnome", "Half-Orc"]>;
    characterClass: z.ZodEnum<["Fighter", "Wizard", "Rogue", "Cleric", "Barbarian", "Paladin", "Ranger", "Sorcerer"]>;
    attributes: z.ZodObject<{
        str: z.ZodNumber;
        dex: z.ZodNumber;
        con: z.ZodNumber;
        int: z.ZodNumber;
        wis: z.ZodNumber;
        cha: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    }, {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    }>;
}, "strip", z.ZodTypeAny, {
    race: "Human" | "Elf" | "Dwarf" | "Halfling" | "Dragonborn" | "Half-Elf" | "Gnome" | "Half-Orc";
    characterClass: "Fighter" | "Wizard" | "Rogue" | "Cleric" | "Barbarian" | "Paladin" | "Ranger" | "Sorcerer";
    attributes: {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    };
    playerName: string;
    characterName: string;
    gameId: string;
}, {
    race: "Human" | "Elf" | "Dwarf" | "Halfling" | "Dragonborn" | "Half-Elf" | "Gnome" | "Half-Orc";
    characterClass: "Fighter" | "Wizard" | "Rogue" | "Cleric" | "Barbarian" | "Paladin" | "Ranger" | "Sorcerer";
    attributes: {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
    };
    playerName: string;
    characterName: string;
    gameId: string;
}>;
export declare const npcSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    role: z.ZodEnum<["friendly", "neutral", "hostile"]>;
}, "strip", z.ZodTypeAny, {
    name: string;
    role: "friendly" | "neutral" | "hostile";
    description?: string | undefined;
}, {
    name: string;
    role: "friendly" | "neutral" | "hostile";
    description?: string | undefined;
}>;
export declare const eventSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    description?: string | undefined;
}, {
    title: string;
    description?: string | undefined;
}>;
export declare const diceRollSchema: z.ZodObject<{
    diceType: z.ZodUnion<[z.ZodLiteral<4>, z.ZodLiteral<6>, z.ZodLiteral<8>, z.ZodLiteral<10>, z.ZodLiteral<12>, z.ZodLiteral<20>]>;
    count: z.ZodNumber;
    modifier: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    count: number;
    diceType: 4 | 6 | 8 | 10 | 12 | 20;
    modifier?: number | undefined;
}, {
    count: number;
    diceType: 4 | 6 | 8 | 10 | 12 | 20;
    modifier?: number | undefined;
}>;
export type CreateGameInput = z.infer<typeof createGameSchema>;
export type JoinGameInput = z.infer<typeof joinGameSchema>;
export type CharacterInput = z.infer<typeof createCharacterSchema>;
export type NPCInput = z.infer<typeof npcSchema>;
export type EventInput = z.infer<typeof eventSchema>;
export type DiceRollInput = z.infer<typeof diceRollSchema>;
export { scenarioOptions, scenarioDescriptions } from "./scenario.js";
export type { Scenario } from "./scenario.js";
//# sourceMappingURL=game.d.ts.map