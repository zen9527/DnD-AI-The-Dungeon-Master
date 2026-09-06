import { t } from "../i18n.js";
import type { LLMProviderId } from "../../../shared/schemas/config.js";

interface StoredConfig {
  llmBaseUrl: string;
  /** Masked by the server — the real key never crosses the wire. */
  llmApiKey: string;
  llmModel: string;
  llmProvider: LLMProviderId;
}

async function loadConfig(): Promise<StoredConfig | null> {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/** Probes the stored `.env` config server-side; there is no body to send. */
async function testStoredConfig(): Promise<{ connected: boolean; message: string }> {
  try {
    const response = await fetch("/api/config/test", { method: "POST" });
    if (!response.ok) throw new Error("Test failed");
    return response.json();
  } catch (error) {
    return { connected: false, message: error instanceof Error ? error.message : t("error.unknown") };
  }
}

/**
 * The LLM settings dialog — read-only. `.env` is the single source of truth;
 * changing provider, endpoint, model or key means editing that file and
 * restarting the server. What remains here is the ability to see the effective
 * configuration and prove it works without playing a turn into a wall.
 */
export class SettingsModal {
  private modal: HTMLElement | null = null;

  show(): void {
    this.modal = document.createElement("div");
    this.modal.className = "settings-modal";
    this.modal.innerHTML = this.template();
    document.body.appendChild(this.modal);

    // Dismissal (✕ / backdrop) is handled by app.ts's global delegation; only
    // the probe needs local wiring, and it lives on an element that dies with
    // the dialog — so no listener can outlive it.
    this.modal.querySelector("#test-btn")?.addEventListener("click", event => {
      const button = event.currentTarget as HTMLButtonElement;
      button.disabled = true;
      void testStoredConfig().then(result => {
        button.disabled = false;
        this.showResult(
          result.connected,
          result.connected ? t("settings.test_connected") : t("settings.test_error", { message: result.message })
        );
      });
    });

    void this.fill();
  }

  close(): void {
    this.modal?.remove();
    this.modal = null;
  }

  private template(): string {
    return `
      <div class="settings-overlay" data-action="close"></div>
      <div class="settings-panel">
        <div class="settings-header">
          <h3>⚙️ ${t("settings.title")}</h3>
          <button class="close-btn" data-action="close">✕</button>
        </div>
        <dl class="settings-rows">
          <div><dt>${t("settings.provider")}</dt><dd id="config-provider">…</dd></div>
          <div id="config-url-row"><dt>${t("settings.api_url")}</dt><dd id="config-url">…</dd></div>
          <div><dt>${t("settings.model")}</dt><dd id="config-model">…</dd></div>
          <div><dt>${t("settings.api_key")}</dt><dd id="config-key">…</dd></div>
        </dl>
        <div class="settings-actions">
          <button type="button" id="test-btn" class="secondary">${t("settings.test_connection_btn")}</button>
        </div>
        <div id="settings-result" class="settings-result"></div>
        <p class="settings-hint">${t("settings.readonly_hint")}</p>
      </div>
    `;
  }

  private async fill(): Promise<void> {
    const config = await loadConfig();
    if (!config || !this.modal) return;

    const set = (id: string, value: string) => this.modal?.querySelector(id)?.replaceChildren(value);
    set("#config-provider", config.llmProvider);
    set("#config-model", config.llmModel || "—");
    set("#config-key", config.llmApiKey || "—");

    // Claude talks to Anthropic's own endpoint unless the .env overrides it.
    const urlRow = this.modal.querySelector<HTMLElement>("#config-url-row");
    if (config.llmProvider === "anthropic" && !config.llmBaseUrl) {
      if (urlRow) set("#config-url", "api.anthropic.com (SDK default)");
    } else {
      set("#config-url", config.llmBaseUrl || "—");
    }
  }

  private showResult(ok: boolean, message: string): void {
    const resultDiv = this.modal?.querySelector("#settings-result");
    if (!resultDiv) return;
    resultDiv.className = `settings-result ${ok ? "success" : "error"}`;
    resultDiv.textContent = message;
  }
}
