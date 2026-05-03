import { z } from "zod";
export const SUPPORTED_LOCALES = ["en-US", "zh-CN", "ja-JP", "es-ES", "ko-KR"];
export const LOCALE_DISPLAY = {
    "en-US": "English",
    "zh-CN": "简体中文",
    "ja-JP": "日本語",
    "es-ES": "Español",
    "ko-KR": "한국어",
};
export const LOCALE_NATIVE = {
    "en-US": "English",
    "zh-CN": "简体中文",
    "ja-JP": "日本語",
    "es-ES": "Español",
    "ko-KR": "한국어",
};
export const LOCALE_LLM_NAME = {
    "en-US": "English",
    "zh-CN": "Chinese (Simplified)",
    "ja-JP": "Japanese",
    "es-ES": "Spanish",
    "ko-KR": "Korean",
};
export const localeSchema = z.enum(SUPPORTED_LOCALES).default("en-US");
//# sourceMappingURL=locale.js.map