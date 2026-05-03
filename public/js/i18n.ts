// public/js/i18n.ts — Lightweight frontend i18n runtime
import en from "../../locales/en-US.json";
import zhCN from "../../locales/zh-CN.json";
import jaJP from "../../locales/ja-JP.json";
import esES from "../../locales/es-ES.json";
import koKR from "../../locales/ko-KR.json";

const LOCALES = { "en-US": en, "zh-CN": zhCN, "ja-JP": jaJP, "es-ES": esES, "ko-KR": koKR } as const;

export type SupportedLocale = keyof typeof LOCALES;
type TranslationKeys = keyof (typeof en);

let currentLocale: SupportedLocale = "en-US";

/** Initialize i18n — restore locale from localStorage */
export function initI18n(): void {
  const saved = localStorage.getItem("dnd-locale") as SupportedLocale | null;
  if (saved && saved in LOCALES) {
    currentLocale = saved;
  }
  applyHtmlLang();
}

/** Get the current locale code */
export function getLocale(): SupportedLocale {
  return currentLocale;
}

/** Set a new locale and persist to localStorage */
export function setLocale(locale: SupportedLocale): void {
  currentLocale = locale;
  localStorage.setItem("dnd-locale", locale);
  applyHtmlLang();
}

/** Update the HTML lang attribute based on current locale */
function applyHtmlLang(): void {
  const langMap: Record<SupportedLocale, string> = {
    "en-US": "en", "zh-CN": "zh-CN", "ja-JP": "ja", "es-ES": "es", "ko-KR": "ko",
  };
  document.documentElement.lang = langMap[currentLocale] || "en";
}

/** Translate a key with optional parameter interpolation */
export function t(key: TranslationKeys, params?: Record<string, string | number>): string {
  const localeData = LOCALES[currentLocale];
  let str = (localeData as Record<string, string>)[key] ?? en[key as keyof typeof en] ?? key;
  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      str = str.replace(`{${paramKey}}`, String(value));
    }
  }
  return str;
}

/** Get the display name for a locale */
export function getLocaleDisplayName(locale: SupportedLocale): string {
  const names: Record<SupportedLocale, string> = {
    "en-US": "English", "zh-CN": "简体中文", "ja-JP": "日本語", "es-ES": "Español", "ko-KR": "한국어",
  };
  return names[locale];
}

/** Array of supported locale codes */
export const SUPPORTED_LOCALES = Object.keys(LOCALES) as SupportedLocale[];

/** Get localized scenario descriptions for the current locale */
export function getLocalizedScenarios(): Record<string, { label: string; icon: string; description: string }> {
  const localeData = LOCALES[currentLocale] as Record<string, unknown>;
  const enData = en as Record<string, unknown>;

  return {
    dungeon: {
      label: (localeData["scenario.dungeon.label"] ?? enData["scenario.dungeon.label"]) as string,
      icon: "🏰",
      description: (localeData["scenario.dungeon.description"] ?? enData["scenario.dungeon.description"]) as string,
    },
    wilderness: {
      label: (localeData["scenario.wilderness.label"] ?? enData["scenario.wilderness.label"]) as string,
      icon: "🌲",
      description: (localeData["scenario.wilderness.description"] ?? enData["scenario.wilderness.description"]) as string,
    },
    intrigue: {
      label: (localeData["scenario.intrigue.label"] ?? enData["scenario.intrigue.label"]) as string,
      icon: "🗡️",
      description: (localeData["scenario.intrigue.description"] ?? enData["scenario.intrigue.description"]) as string,
    },
    horror: {
      label: (localeData["scenario.horror.label"] ?? enData["scenario.horror.label"]) as string,
      icon: "🌑",
      description: (localeData["scenario.horror.description"] ?? enData["scenario.horror.description"]) as string,
    },
    epic: {
      label: (localeData["scenario.epic.label"] ?? enData["scenario.epic.label"]) as string,
      icon: "⚔️",
      description: (localeData["scenario.epic.description"] ?? enData["scenario.epic.description"]) as string,
    },
    sea: {
      label: (localeData["scenario.sea.label"] ?? enData["scenario.sea.label"]) as string,
      icon: "⛵",
      description: (localeData["scenario.sea.description"] ?? enData["scenario.sea.description"]) as string,
    },
  };
}

/** Get localized name data for a specific race in the current locale */
export function getLocalizedNames(race: string): { firstNames: string[]; lastParts: string[] } {
  const localeData = LOCALES[currentLocale] as Record<string, unknown>;
  const enData = en as Record<string, unknown>;

  // Map race names to JSON key (e.g., "Half-Elf" → "half-elf")
  const raceKey = race.toLowerCase().replace(" ", "-");
  const firstKey = `name.${raceKey}.first`;
  const lastKey = `name.${raceKey}.last`;

  return {
    firstNames: (localeData[firstKey] ?? enData[firstKey]) as string[] || [],
    lastParts: (localeData[lastKey] ?? enData[lastKey]) as string[] || [],
  };
}
