import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Use process.cwd() so it works both in source (ts) and compiled (dist)
const LOCALES_DIR = path.join(process.cwd(), "locales");

// Cache loaded locale data
const localeCache: Record<string, Record<string, string>> = {};

/**
 * Load locale JSON with fallback chain (locale → en-US → empty).
 * Caches loaded locales to avoid repeated file reads.
 */
export function loadLocale(locale: string, visited: Set<string> = new Set()): Record<string, string> {
  if (localeCache[locale]) return localeCache[locale];

  // Recursion guard — prevents infinite loop if fallback chain is broken
  if (visited.has(locale)) {
    console.warn(`[Locale] Circular fallback detected for "${locale}", returning empty object`);
    return {};
  }
  visited.add(locale);

  const filePath = path.join(LOCALES_DIR, `${locale}.json`);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    localeCache[locale] = JSON.parse(raw) as Record<string, string>;
    return localeCache[locale];
  } catch {
    console.warn(`[Locale] File not found: ${filePath}, falling back to en-US`);
    if (locale === "en-US") {
      console.error("[Locale] en-US.json not found! Returning empty locale data.");
      return {};
    }
    return loadLocale("en-US", visited);
  }
}

/**
 * Get a localized string. Falls back to key itself if not found in current locale,
 * then tries en-US as ultimate fallback.
 */
export function getLocalizedMessage(locale: string, key: string): string {
  const data = loadLocale(locale);
  let value = data[key];
  
  // If not found in current locale, try English
  if (!value || value === key) {
    const enData = loadLocale("en-US");
    value = enData[key] || key;
  }
  
  return value;
}
