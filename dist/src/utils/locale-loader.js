import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.join(__dirname, "../../locales");
// Cache loaded locale data
const localeCache = {};
export function loadLocale(locale) {
    if (localeCache[locale])
        return localeCache[locale];
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    try {
        const raw = fs.readFileSync(filePath, "utf-8");
        localeCache[locale] = JSON.parse(raw);
        return localeCache[locale];
    }
    catch {
        // Fallback to English
        return loadLocale("en-US");
    }
}
/**
 * Get a localized string. Falls back to key itself if not found in current locale,
 * then tries en-US as ultimate fallback.
 */
export function getLocalizedMessage(locale, key) {
    const data = loadLocale(locale);
    let value = data[key];
    // If not found in current locale, try English
    if (!value || value === key) {
        const enData = loadLocale("en-US");
        value = enData[key] || key;
    }
    return value;
}
//# sourceMappingURL=locale-loader.js.map