import type { Attributes } from "../types/index.js";
import type { Scenario } from "../../shared/schemas/scenario.js";

/**
 * Default attribute values by character class.
 * Each class gets bonuses to 2-3 relevant attributes (starting at base 10).
 */
const CLASS_ATTRIBUTE_BONUSES: Record<string, Partial<Attributes>> = {
  // Strength-focused classes
  "Barbarian": { str: 16, con: 14 },
  "Fighter": { str: 15, con: 13 },
  "Paladin": { str: 15, cha: 13, con: 12 },
  
  // Dexterity-focused classes  
  "Rogue": { dex: 16, int: 12 },
  "Ranger": { dex: 14, wis: 13, str: 12 },
  
  // Intelligence-focused classes
  "Wizard": { int: 17, wis: 12 },
  "Artificer": { int: 15, con: 12 },
  
  // Wisdom-focused classes
  "Cleric": { wis: 16, cha: 12, con: 13 },
  "Druid": { wis: 15, int: 12, con: 13 },
  "Monk": { dex: 14, wis: 14, str: 10 },
  
  // Charisma-focused classes
  "Bard": { cha: 16, dex: 12, int: 12 },
  "Sorcerer": { cha: 15, con: 12 },
  "Warlock": { cha: 15, wis: 12 },
};

/**
 * Default attributes per race (bonuses added to class base).
 */
const RACE_ATTRIBUTE_BONUSES: Record<string, Partial<Attributes>> = {
  "Human": { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, // +1 all
  "Elf": { dex: 2 },
  "Dwarf": { con: 2 },
  "Halfling": { dex: 2, luck: 1 } as Partial<Attributes>,
  "Dragonborn": { str: 2, cha: 2 },
  "Half-Elf": { cha: 2, dex: 1, wis: 1 } as Partial<Attributes>,
  "Gnome": { int: 2 },
  "Half-Orc": { str: 2, con: 2 },
};

/**
 * Generate default attributes based on class and race.
 * Uses 3-18 range per D&D rules, with bonuses applied to base 10 stats.
 */
export function generateDefaultAttributes(characterClass: string, race: string): Attributes {
  const classBonuses = CLASS_ATTRIBUTE_BONUSES[characterClass] || {};
  const raceBonuses = RACE_ATTRIBUTE_BONUSES[race] || {};

  // Start with base 10 for all attributes
  let attrs: Attributes = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  // Apply class bonuses
  if (classBonuses.str) attrs.str += classBonuses.str;
  if (classBonuses.dex) attrs.dex += classBonuses.dex;
  if (classBonuses.con) attrs.con += classBonuses.con;
  if (classBonuses.int) attrs.int += classBonuses.int;
  if (classBonuses.wis) attrs.wis += classBonuses.wis;
  if (classBonuses.cha) attrs.cha += classBonuses.cha;

  // Apply race bonuses
  if (raceBonuses.str) attrs.str += raceBonuses.str;
  if (raceBonuses.dex) attrs.dex += raceBonuses.dex;
  if (raceBonuses.con) attrs.con += raceBonuses.con;
  if (raceBonuses.int) attrs.int += raceBonuses.int;
  if (raceBonuses.wis) attrs.wis += raceBonuses.wis;
  if (raceBonuses.cha) attrs.cha += raceBonuses.cha;

  // Clamp to valid D&D range (3-18)
  return {
    str: Math.max(3, Math.min(18, attrs.str)),
    dex: Math.max(3, Math.min(18, attrs.dex)),
    con: Math.max(3, Math.min(18, attrs.con)),
    int: Math.max(3, Math.min(18, attrs.int)),
    wis: Math.max(3, Math.min(18, attrs.wis)),
    cha: Math.max(3, Math.min(18, attrs.cha)),
  };
}

/**
 * Default scenario descriptions and starting locations.
 */
export const SCENARIO_DEFAULTS: Record<Scenario, { label: string; description: string; startingLocation: string }> = {
  "dungeon": {
    label: "Dungeon Crawl",
    description: "Explore ancient underground ruins filled with traps, monsters, and treasure",
    startingLocation: "The cold stone entrance of a forgotten crypt"
  },
  "wilderness": {
    label: "Wilderness Adventure", 
    description: "Traverse untamed lands, face nature's dangers, and discover hidden places",
    startingLocation: "A misty forest clearing at dawn"
  },
  "intrigue": {
    label: "Urban Intrigue",
    description: "Navigate political schemes, social gatherings, and city secrets",
    startingLocation: "The bustling marketplace of a noble city"
  },
  "horror": {
    label: "Horror & Mystery",
    description: "Investigate fog-shrouded towns and strange supernatural occurrences",
    startingLocation: "A dimly lit tavern in a fog-covered village"
  },
  "epic": {
    label: "Epic Quest", 
    description: "Fulfill a legendary prophecy against an ancient evil force",
    startingLocation: "The ruins of an ancient temple where the prophecy began"
  },
  "sea": {
    label: "Sea Adventure",
    description: "Sail open oceans, discover mysterious islands, and face pirates or sea monsters",
    startingLocation: "The deck of a weathered ship anchored in a quiet harbor"
  }
};

/**
 * Generate default character name based on class and race.
 */
export function generateDefaultCharacterName(characterClass: string, race: string): string {
  const className = characterClass.toLowerCase();
  const raceName = race.toLowerCase();
  
  // Simple naming convention based on class archetype
  const namePrefixes: Record<string, string> = {
    "barbarian": "Thor",
    "fighter": "Garret", 
    "paladin": "Aldric",
    "rogue": "Kael",
    "ranger": "Sylvan",
    "wizard": "Elara",
    "cleric": "Theron",
    "druid": "Rowan",
    "monk": "Jian",
    "bard": "Lyra",
    "sorcerer": "Ignis",
    "warlock": "Vesper"
  };

  const prefix = namePrefixes[className] || "Adventurer";
  
  // Add race suffix modifier
  let suffix = "";
  if (raceName.includes("elf")) suffix = "-star";
  else if (raceName.includes("dwarf")) suffix = "-stone";
  else if (raceName.includes("human")) suffix = "";
  else suffix = "";

  return `${prefix}${suffix}`;
}

/**
 * Default starting inventory based on class.
 */
export function generateDefaultInventory(characterClass: string): Array<{ name: string; type: 'weapon' | 'armor' | 'potion' | 'misc'; description: string }> {
  const basePotions = [
    { name: "Health Potion", type: "potion" as const, description: "Restores 10 HP", weight: 0.5 }
  ];

  const classGear: Record<string, Array<{ name: string; type: 'weapon' | 'armor' | 'potion' | 'misc'; description: string; weight: number }>> = {
    "Barbarian": [
      { name: "Greataxe", type: "weapon", description: "Heavy two-handed axe", weight: 7.0 },
      { name: "Hide Armor", type: "armor", description: "Thick beast hide protection", weight: 12.0 }
    ],
    "Fighter": [
      { name: "Longsword", type: "weapon", description: "Versatile blade", weight: 3.0 },
      { name: "Chain Mail", type: "armor", description: "Full metal armor", weight: 55.0 }
    ],
    "Paladin": [
      { name: "Holy Sword", type: "weapon", description: "Blessed blade of justice", weight: 3.0 },
      { name: "Plate Armor", type: "armor", description: "Shining full plate", weight: 65.0 }
    ],
    "Rogue": [
      { name: "Rapier", type: "weapon", description: "Finesse blade", weight: 2.0 },
      { name: "Leather Armor", type: "armor", description: "Light and silent", weight: 10.0 }
    ],
    "Wizard": [
      { name: "Quarterstaff", type: "weapon", description: "Simple wooden staff", weight: 4.0 },
      { name: "Spellbook", type: "misc", description: "Contains arcane formulas", weight: 3.0 }
    ],
    "Cleric": [
      { name: "Mace", type: "weapon", description: "Holy blunt weapon", weight: 4.0 },
      { name: "Scale Mail", type: "armor", description: "Medium protection", weight: 45.0 }
    ]
  };

  return [...(classGear[characterClass] || basePotions), ...basePotions];
}
