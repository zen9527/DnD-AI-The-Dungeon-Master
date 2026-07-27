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

const NOTIFICATION_MS: Record<NotificationType, number> = {
  success: 4000,
  info: 4000,
  warning: 7000,
  // Errors usually mean the thing you just tried did not happen. Four seconds
  // in a corner is easy to miss, and then the app just looks broken.
  error: 10000,
};

export function showNotification(text: string, type: NotificationType = "info"): void {
  document.querySelector(".notification")?.remove();

  const notif = document.createElement("div");
  notif.className = `notification notification-${type}`;
  notif.textContent = text;
  notif.setAttribute("role", type === "error" ? "alert" : "status");

  const dismiss = document.createElement("button");
  dismiss.className = "notification-dismiss";
  dismiss.setAttribute("aria-label", "Dismiss");
  dismiss.textContent = "✕";
  dismiss.addEventListener("click", () => notif.remove());
  notif.appendChild(dismiss);

  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), NOTIFICATION_MS[type]);
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
