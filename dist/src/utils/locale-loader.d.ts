export declare function loadLocale(locale: string): Record<string, string>;
/**
 * Get a localized string. Falls back to key itself if not found in current locale,
 * then tries en-US as ultimate fallback.
 */
export declare function getLocalizedMessage(locale: string, key: string): string;
//# sourceMappingURL=locale-loader.d.ts.map