// ============================================================================
// Shared Frontend Utilities
// ============================================================================

export type NotificationType = "success" | "error" | "info" | "warning";

export function escapeHtml(text: string): string {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function showNotification(text: string, type: NotificationType = "info"): void {
  const existing = document.querySelector(".notification");
  if (existing) existing.remove();

  const notif = document.createElement("div");
  notif.className = `notification notification-${type}`;
  notif.textContent = text;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 4000);
}

export function getLocaleDisplayName(locale: string): string {
  const names: Record<string, string> = {
    "en-US": "English",
    "zh-CN": "简体中文",
    "ja-JP": "日本語",
    "es-ES": "Español",
    "ko-KR": "한국어",
  };
  return names[locale] || locale;
}

export function renderLocaleDropdownHTML(supportedLocales: readonly string[], currentLocale: string, getLocaleName?: (locale: string) => string): string {
  const getName = getLocaleName || getLocaleDisplayName;
  return `<select id="locale-select" class="locale-selector">
    ${supportedLocales.map(l => `<option value="${l}" ${l === currentLocale ? 'selected' : ''}>${getName(l)}</option>`).join("")}
  </select>`;
}
