import { z } from "zod";

export const SUPPORTED_LOCALES = ["en-US", "zh-CN", "ja-JP", "es-ES", "ko-KR"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_DISPLAY: Record<SupportedLocale, string> = {
  "en-US": "English",
  "zh-CN": "简体中文",
  "ja-JP": "日本語",
  "es-ES": "Español",
  "ko-KR": "한국어",
};

export const LOCALE_NATIVE: Record<SupportedLocale, string> = {
  "en-US": "English",
  "zh-CN": "简体中文",
  "ja-JP": "日本語",
  "es-ES": "Español",
  "ko-KR": "한국어",
};

export const LOCALE_LLM_NAME: Record<SupportedLocale, string> = {
  "en-US": "English",
  "zh-CN": "Chinese (Simplified)",
  "ja-JP": "Japanese",
  "es-ES": "Spanish",
  "ko-KR": "Korean",
};

export const localeSchema = z.enum(SUPPORTED_LOCALES).default("en-US");
