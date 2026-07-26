import type { Attributes, Player } from "../types/index.js";
import { HIT_DIE_BY_CLASS } from "../../shared/schemas/game.js";

/** The character details a client supplies; everything else is a level-1 default. */
export interface CreatePlayerConfig {
  id: string;
  name: string;
  characterName: string;
  race: string;
  characterClass: string;
  attributes: Attributes;
  isDM?: boolean;
  locale?: string;
}

const STARTING_HP = 10;
const STARTING_AC = 11;
const STARTING_PROFICIENCY_BONUS = 2;
const DEFAULT_HIT_DIE = 8;

/**
 * Build a fresh level-1 player. Single source of truth for starting stats, so
 * the create-game and join-game paths can never drift apart.
 */
export function createPlayer(config: CreatePlayerConfig): Player {
  return {
    id: config.id,
    name: config.name,
    characterName: config.characterName,
    isDM: config.isDM ?? false,
    race: config.race,
    characterClass: config.characterClass,
    level: 1,
    attributes: config.attributes,
    hp: STARTING_HP,
    maxHp: STARTING_HP,
    ac: STARTING_AC,
    proficiencyBonus: STARTING_PROFICIENCY_BONUS,
    spellSlots: {},
    spells: [],
    inventory: [],
    equippedWeapon: undefined,
    equippedArmor: undefined,
    usedItems: [],
    conditions: [],
    buffs: [],
    hitDice: { total: HIT_DIE_BY_CLASS[config.characterClass] || DEFAULT_HIT_DIE, used: 0 },
    deathSaves: { successes: 0, failures: 0 },
    xp: 0,
    locale: config.locale || "en-US",
  };
}
