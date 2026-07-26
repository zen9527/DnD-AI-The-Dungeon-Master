import { describe, it, expect, vi } from "vitest";

vi.mock("../../public/js/i18n.js", () => ({
  t: (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${Object.values(params).join(",")}` : key,
  getLocalizedNames: (race: string) =>
    race === "Nameless"
      ? { firstNames: [], lastParts: [] }
      : { firstNames: ["Ana", "Bo", "Cai"], lastParts: ["Stone", "Vale"] },
}));

const { generateDefaultAttributes, generateDefaultCharacterName } = await import(
  "../../public/js/character-defaults.js"
);

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;

/**
 * The bonus table used to hold target scores ("Barbarian: str 16") but was
 * added to a base of 10, so every primary stat overshot and clamped to 18 —
 * auto-fill handed every class maxed stats, and a Rogue came out with INT 18.
 */
describe("generateDefaultAttributes", () => {
  it("keeps every score inside the legal 3-18 range", () => {
    for (const characterClass of ["Barbarian", "Wizard", "Rogue", "Cleric", "Bard"]) {
      for (const race of ["Human", "Elf", "Dwarf", "Half-Orc"]) {
        const attributes = generateDefaultAttributes(characterClass, race);
        for (const ability of ABILITIES) {
          expect(attributes[ability], `${characterClass}/${race} ${ability}`).toBeGreaterThanOrEqual(3);
          expect(attributes[ability], `${characterClass}/${race} ${ability}`).toBeLessThanOrEqual(18);
        }
      }
    }
  });

  it("does not max out a class's primary stat", () => {
    // The old table produced 18 here for every class.
    expect(generateDefaultAttributes("Fighter", "Dwarf").str).toBeLessThan(18);
    expect(generateDefaultAttributes("Wizard", "Elf").int).toBeLessThan(18);
  });

  it("leaves stats a class does not care about near the base score", () => {
    const wizard = generateDefaultAttributes("Wizard", "Elf");
    expect(wizard.str).toBe(10);
    // A Wizard should not come out with a maxed secondary.
    expect(wizard.wis).toBeLessThan(wizard.int);
  });

  it("favours the ability each class is built around", () => {
    const cases = [
      ["Barbarian", "str"], ["Wizard", "int"], ["Rogue", "dex"],
      ["Cleric", "wis"], ["Bard", "cha"],
    ] as const;

    for (const [characterClass, primary] of cases) {
      const attributes = generateDefaultAttributes(characterClass, "Human");
      const highest = Math.max(...ABILITIES.map(a => attributes[a]));
      expect(attributes[primary], `${characterClass} should lead with ${primary}`).toBe(highest);
    }
  });

  it("applies the racial increase on top of the class profile", () => {
    expect(generateDefaultAttributes("Fighter", "Dwarf").con)
      .toBe(generateDefaultAttributes("Fighter", "Elf").con + 2);
  });

  it("falls back to the base score for an unknown class or race", () => {
    const attributes = generateDefaultAttributes("Astronaut", "Martian");
    for (const ability of ABILITIES) expect(attributes[ability]).toBe(10);
  });
});

describe("generateDefaultCharacterName", () => {
  it("suggests the same name for the same class and race", () => {
    expect(generateDefaultCharacterName("Wizard", "Elf")).toBe(generateDefaultCharacterName("Wizard", "Elf"));
  });

  it("varies the name across different characters", () => {
    const names = new Set([
      generateDefaultCharacterName("Wizard", "Elf"),
      generateDefaultCharacterName("Barbarian", "Dwarf"),
      generateDefaultCharacterName("Rogue", "Halfling"),
    ]);
    expect(names.size).toBeGreaterThan(1);
  });

  it("builds the name from the locale's own name lists", () => {
    const name = generateDefaultCharacterName("Wizard", "Elf");
    const [first, last] = name.split(" ");
    expect(["Ana", "Bo", "Cai"]).toContain(first);
    expect(["Stone", "Vale"]).toContain(last);
  });

  it("falls back gracefully when a locale has no names for a race", () => {
    expect(generateDefaultCharacterName("Wizard", "Nameless")).toContain("character.fallback_name");
  });
});
