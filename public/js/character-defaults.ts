import { getLocalizedNames, t } from "./i18n.js";
import type { Attributes } from "../../shared/index.js";

/**
 * Suggested starting stats and names for the character creator.
 *
 * These are pure functions of class, race and locale, which is what makes them
 * worth keeping out of the DOM code: they can be tested directly, and the
 * creator only has to decide when to call them.
 */

const BASE_SCORE = 10;
const MIN_SCORE = 3;
const MAX_SCORE = 18;

/** Where a class puts its best rolls, as a delta on the base score. */
const CLASS_ATTRIBUTE_BONUSES: Record<string, Partial<Attributes>> = {
  Barbarian: { str: 6, con: 4 },
  Fighter: { str: 5, con: 3 },
  Paladin: { str: 5, cha: 3, con: 2 },
  Rogue: { dex: 6, int: 2 },
  Ranger: { dex: 4, wis: 3, str: 2 },
  Wizard: { int: 7, wis: 2 },
  Artificer: { int: 5, con: 2 },
  Cleric: { wis: 6, cha: 2, con: 3 },
  Druid: { wis: 5, int: 2, con: 3 },
  Monk: { dex: 4, wis: 4 },
  Bard: { cha: 6, dex: 2, int: 2 },
  Sorcerer: { cha: 5, con: 2 },
  Warlock: { cha: 5, wis: 2 },
};

/** D&D 5e racial ability score increases. */
const RACE_ATTRIBUTE_BONUSES: Record<string, Partial<Attributes>> = {
  Human: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
  Elf: { dex: 2 },
  Dwarf: { con: 2 },
  Halfling: { dex: 2 },
  Dragonborn: { str: 2, cha: 2 },
  "Half-Elf": { cha: 2, dex: 1, wis: 1 },
  Gnome: { int: 2 },
  "Half-Orc": { str: 2, con: 2 },
};

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;

/** Suggested attributes for a class/race pair, clamped to the legal 3–18 range. */
export function generateDefaultAttributes(characterClass: string, race: string): Attributes {
  const classBonuses = CLASS_ATTRIBUTE_BONUSES[characterClass] ?? {};
  const raceBonuses = RACE_ATTRIBUTE_BONUSES[race] ?? {};

  const attributes = {} as Attributes;
  for (const ability of ABILITIES) {
    const total = BASE_SCORE + (classBonuses[ability] ?? 0) + (raceBonuses[ability] ?? 0);
    attributes[ability] = Math.max(MIN_SCORE, Math.min(MAX_SCORE, total));
  }
  return attributes;
}

/**
 * A name drawn from the current locale's name lists.
 *
 * The choice is seeded from the class and race rather than randomised, so the
 * same combination always suggests the same name — re-opening the form doesn't
 * silently rename the character you were about to make.
 */
export function generateDefaultCharacterName(characterClass: string, race: string): string {
  const { firstNames, lastParts } = getLocalizedNames(race);

  if (firstNames.length === 0 || lastParts.length === 0) {
    return t("character.fallback_name", { characterClass, race });
  }

  const sumCharCodes = (text: string) => [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const classHash = sumCharCodes(characterClass);
  const raceHash = sumCharCodes(race);

  const first = firstNames[(classHash * 31 + raceHash * 17) % firstNames.length];
  const last = lastParts[(classHash * 19 + raceHash * 23) % lastParts.length];
  return `${first} ${last}`;
}
