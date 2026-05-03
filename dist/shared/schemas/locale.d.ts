import { z } from "zod";
export declare const SUPPORTED_LOCALES: readonly ["en-US", "zh-CN", "ja-JP", "es-ES", "ko-KR"];
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export declare const LOCALE_DISPLAY: Record<SupportedLocale, string>;
export declare const LOCALE_NATIVE: Record<SupportedLocale, string>;
export declare const LOCALE_LLM_NAME: Record<SupportedLocale, string>;
export declare const localeSchema: z.ZodDefault<z.ZodEnum<["en-US", "zh-CN", "ja-JP", "es-ES", "ko-KR"]>>;
//# sourceMappingURL=locale.d.ts.map