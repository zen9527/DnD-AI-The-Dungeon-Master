import { t } from "../i18n.js";
import { endpointPresets, type LLMProviderId } from "../../../shared/schemas/config.js";

interface LLMConfig {
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  llmProvider: LLMProviderId;
}

const DEFAULT_CONFIG: LLMConfig = {
  llmBaseUrl: "http://localhost:1234/v1",
  llmApiKey: "",
  llmModel: "",
  llmProvider: "openai-compatible",
};

async function loadConfig(): Promise<LLMConfig> {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) throw new Error("Failed to load config");
    return response.json();
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function saveConfig(config: LLMConfig): Promise<{ saved: boolean; restartRequired: boolean }> {
  try {
    const response = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error("Save failed");
    const result = await response.json();
    return { saved: result.success === true, restartRequired: result.restartRequired === true };
  } catch {
    return { saved: false, restartRequired: false };
  }
}

async function testConfig(config: LLMConfig): Promise<{ connected: boolean; message: string }> {
  try {
    const response = await fetch("/api/config/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (!response.ok) throw new Error("Test failed");
    return response.json();
  } catch (error) {
    return { connected: false, message: error instanceof Error ? error.message : t("error.unknown") };
  }
}

async function fetchModels(
  provider: LLMProviderId,
  url: string,
  apiKey: string
): Promise<{ models: string[]; error: string | null }> {
  try {
    const params = new URLSearchParams({ provider, url, key: apiKey });
    const response = await fetch(`/api/config/models?${params}`);
    if (!response.ok) throw new Error("Failed to fetch models");
    return response.json();
  } catch (error) {
    return { models: [], error: error instanceof Error ? error.message : t("error.unknown") };
  }
}

/**
 * The LLM endpoint settings dialog: pick a preset or a custom URL, list the
 * models that endpoint offers, test the connection, and persist to `.env`.
 */
export class SettingsModal {
  private modal: HTMLElement | null = null;
  private urlInput!: HTMLInputElement;
  private keyInput!: HTMLInputElement;
  private modelSelect!: HTMLSelectElement;
  private statusEl!: HTMLElement | null;
  /** Drives which fields are shown and which protocol the probes use. */
  private provider: LLMProviderId = "openai-compatible";

  show(): void {
    this.modal = document.createElement("div");
    this.modal.className = "settings-modal";
    this.modal.innerHTML = this.template();
    document.body.appendChild(this.modal);

    this.urlInput = this.modal.querySelector("#config-url") as HTMLInputElement;
    this.keyInput = this.modal.querySelector("#config-key") as HTMLInputElement;
    this.modelSelect = this.modal.querySelector("#config-model-select") as HTMLSelectElement;
    this.statusEl = this.modal.querySelector("#model-status");

    this.bindEvents();
    void this.loadCurrentConfig();
  }

  close(): void {
    this.modal?.remove();
    this.modal = null;
  }

  private template(): string {
    const presets = endpointPresets.map((p, i) => `<option value="${i}">${p.name}</option>`).join("");

    return `
      <div class="settings-overlay" data-action="close"></div>
      <div class="settings-panel">
        <div class="settings-header">
          <h3>⚙️ ${t("settings.title")}</h3>
          <button class="close-btn" data-action="close">✕</button>
        </div>
        <form id="settings-form">
          <label>
            ${t("settings.endpoint_preset")}
            <select id="preset-select">${presets}</select>
          </label>
          <label id="config-url-row">
            ${t("settings.api_url")}
            <input type="text" id="config-url" placeholder="http://localhost:1234/v1">
          </label>
          <label>
            ${t("settings.api_key")}
            <input type="password" id="config-key" placeholder="${t("settings.api_key_placeholder")}">
          </label>
          <label>
            ${t("settings.model")}
            <select id="config-model-select"><option value="">${t("settings.model_placeholder")}</option></select>
            <small id="model-status" class="settings-hint">${t("settings.enter_url_key")}</small>
          </label>
          <div class="settings-actions">
            <button type="button" id="fetch-models-btn" class="secondary">${t("settings.fetch_models_btn")}</button>
            <button type="button" id="test-btn" class="secondary">${t("settings.test_connection_btn")}</button>
            <button type="submit" class="primary">${t("settings.save_btn")}</button>
          </div>
          <div id="settings-result" class="settings-result"></div>
        </form>
      </div>
    `;
  }

  /** Populate the form from the saved config and pre-fetch that endpoint's models. */
  private async loadCurrentConfig(): Promise<void> {
    const config = await loadConfig();
    this.provider = config.llmProvider ?? "openai-compatible";
    this.urlInput.value = config.llmBaseUrl;
    this.keyInput.value = config.llmApiKey;
    this.applyProvider();

    // Match the saved URL to a preset, falling back to "Custom".
    const presetSelect = this.modal?.querySelector("#preset-select") as HTMLSelectElement | null;
    if (presetSelect) {
      const matched = endpointPresets.findIndex(
        p => p.provider === this.provider && (this.provider === "anthropic" || p.url === config.llmBaseUrl)
      );
      const fallback = endpointPresets.findIndex(p => p.name === "Custom");
      const index = matched >= 0 ? matched : fallback;
      if (index >= 0) presetSelect.value = String(index);
    }

    await this.refreshModels(config.llmBaseUrl, config.llmApiKey);

    if (config.llmModel && this.modelSelect.querySelector(`option[value="${config.llmModel}"]`)) {
      this.modelSelect.value = config.llmModel;
    }
  }

  /**
   * The key field is pre-filled with a mask. Sending it back unchanged tells
   * the server to keep the stored key — see utils/secrets.ts.
   */
  private currentConfig(): LLMConfig {
    return {
      llmBaseUrl: this.urlInput.value.trim(),
      llmApiKey: this.keyInput.value.trim(),
      llmModel: this.modelSelect.value,
      llmProvider: this.provider,
    };
  }

  /**
   * Show only the fields the selected provider needs. Claude authenticates with
   * a key against Anthropic's own endpoint, so the URL field is irrelevant
   * there and only gets in the way.
   */
  private applyProvider(): void {
    const isAnthropic = this.provider === "anthropic";

    const urlRow = this.modal?.querySelector<HTMLElement>("#config-url-row");
    if (urlRow) urlRow.style.display = isAnthropic ? "none" : "";

    this.keyInput.required = isAnthropic;
    this.keyInput.placeholder = isAnthropic
      ? t("settings.api_key_required_placeholder")
      : t("settings.api_key_placeholder");
  }

  private showResult(ok: boolean, message: string): void {
    const resultDiv = this.modal?.querySelector("#settings-result");
    if (!resultDiv) return;
    resultDiv.className = `settings-result ${ok ? "success" : "error"}`;
    resultDiv.textContent = message;
  }

  private setStatus(message: string): void {
    if (this.statusEl) this.statusEl.textContent = message;
  }

  /** Query the endpoint for its model list and rebuild the dropdown. */
  private async refreshModels(url: string, apiKey: string): Promise<void> {
    const trimmedUrl = url.trim();
    // Claude talks to Anthropic's own endpoint, so a blank URL is expected there.
    if (!trimmedUrl && this.provider !== "anthropic") {
      this.setStatus(t("settings.fetch_no_url"));
      return;
    }

    this.setStatus(t("settings.fetch_models.loading"));
    this.modelSelect.innerHTML = `<option value="">${t("settings.loading_models")}</option>`;

    const result = await fetchModels(this.provider, trimmedUrl, apiKey.trim());

    if (result.error) {
      this.setStatus(t("settings.fetch_failed", { error: result.error }));
      this.modelSelect.innerHTML = `<option value="">${t("settings.failed_models")}</option>`;
      return;
    }

    if (result.models.length === 0) {
      this.setStatus(t("settings.fetch_no_models"));
      this.modelSelect.innerHTML = `<option value="">${t("settings.no_models")}</option>`;
      return;
    }

    this.modelSelect.innerHTML =
      `<option value="">${t("settings.select_model")}</option>` +
      result.models.map(m => `<option value="${m}">${m}</option>`).join("");
    this.setStatus(t("settings.fetch_success", { count: result.models.length }));
  }

  private bindEvents(): void {
    const modal = this.modal;
    if (!modal) return;

    modal.querySelectorAll("[data-action='close']").forEach(el => {
      el.addEventListener("click", () => this.close());
    });

    modal.querySelector("#preset-select")?.addEventListener("change", async event => {
      const preset = endpointPresets[parseInt((event.target as HTMLSelectElement).value)];
      if (!preset) return;

      this.provider = preset.provider;
      this.urlInput.value = preset.url;
      this.keyInput.value = preset.apiKey;
      this.applyProvider();
      this.modelSelect.innerHTML = `<option value="">${t("settings.model_placeholder")}</option>`;
      this.setStatus(t("settings.enter_url_key"));

      if (preset.url || this.provider === "anthropic") {
        await this.refreshModels(preset.url, this.keyInput.value);
      }
    });

    modal.querySelector("#fetch-models-btn")?.addEventListener("click", () => {
      void this.refreshModels(this.urlInput.value, this.keyInput.value);
    });

    modal.querySelector("#test-btn")?.addEventListener("click", async () => {
      const result = await testConfig(this.currentConfig());
      this.showResult(
        result.connected,
        result.connected ? t("settings.test_connected") : t("settings.test_error", { message: result.message })
      );
    });

    modal.querySelector("#settings-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const { saved, restartRequired } = await saveConfig(this.currentConfig());
      if (!saved) {
        this.showResult(false, t("settings.save_error"));
        return;
      }
      // Games already in progress hold a client built at creation time.
      this.showResult(true, restartRequired
        ? `${t("settings.save_success")} ${t("settings.restart_required")}`
        : t("settings.save_success"));
    });
  }
}
