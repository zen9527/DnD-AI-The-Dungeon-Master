import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Race and Class Localization", () => {
  const locales = ["en-US", "zh-CN", "ja-JP", "es-ES", "ko-KR"];
  const races = ["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Half-Elf", "Gnome", "Half-Orc"];
  const classes = ["Fighter", "Wizard", "Rogue", "Cleric", "Barbarian", "Paladin", "Ranger", "Sorcerer"];

  const LOCALES_DIR = path.join(process.cwd(), "locales");

  locales.forEach(locale => {
    races.forEach(race => {
      it(`should have race.${race.toLowerCase()} translation for ${locale}`, () => {
        const filePath = path.join(LOCALES_DIR, `${locale}.json`);
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const key = `race.${race.toLowerCase()}`;
        expect(data).toHaveProperty(key);
        expect(data[key]).not.toBe(key);
      });
    });

    classes.forEach(cls => {
      it(`should have class.${cls.toLowerCase()} translation for ${locale}`, () => {
        const filePath = path.join(LOCALES_DIR, `${locale}.json`);
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const key = `class.${cls.toLowerCase()}`;
        expect(data).toHaveProperty(key);
        expect(data[key]).not.toBe(key);
      });
    });
  });
});
