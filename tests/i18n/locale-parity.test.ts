import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Guards the invariant that lets `t()` be type-safe: every locale carries the
 * same keys as en-US. A key present in only some locales silently renders as a
 * raw key string for the other languages, which is how the DM panel ended up
 * showing "dm_control.npc_conditions" to users.
 */

const LOCALES_DIR = path.resolve(__dirname, "../../locales");
const SOURCE_LOCALE = "en-US";

function loadLocale(locale: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), "utf8"));
}

const localeFiles = fs
  .readdirSync(LOCALES_DIR)
  .filter(f => f.endsWith(".json"))
  .map(f => f.replace(/\.json$/, ""));

const source = loadLocale(SOURCE_LOCALE);
const sourceKeys = Object.keys(source);

describe("locale files", () => {
  it("includes the source locale", () => {
    expect(localeFiles).toContain(SOURCE_LOCALE);
    expect(sourceKeys.length).toBeGreaterThan(0);
  });

  for (const locale of localeFiles.filter(l => l !== SOURCE_LOCALE)) {
    describe(locale, () => {
      const target = loadLocale(locale);

      it(`has every ${SOURCE_LOCALE} key`, () => {
        expect(sourceKeys.filter(key => !(key in target))).toEqual([]);
      });

      it(`has no keys missing from ${SOURCE_LOCALE}`, () => {
        expect(Object.keys(target).filter(key => !(key in source))).toEqual([]);
      });

      it("uses the same value type for every key", () => {
        const mismatched = sourceKeys.filter(
          key => Array.isArray(source[key]) !== Array.isArray(target[key])
        );
        expect(mismatched).toEqual([]);
      });

      it("keeps the same {placeholders} as the source string", () => {
        const placeholders = (value: unknown): string[] =>
          typeof value === "string" ? (value.match(/\{(\w+)\}/g) ?? []).sort() : [];

        const mismatched = sourceKeys.filter(key => {
          const expected = placeholders(source[key]);
          return expected.length > 0 && placeholders(target[key]).join() !== expected.join();
        });

        expect(mismatched).toEqual([]);
      });
    });
  }
});
