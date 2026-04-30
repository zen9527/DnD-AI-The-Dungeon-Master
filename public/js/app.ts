// public/js/app.ts
import { wsManager } from "./websocket.js";
import { gameState } from "./game-state.js";
import { CharacterCreator } from "./character.js";
import { ActionBar } from "./action-bar.js";
import { endpointPresets } from "../../shared/schemas/config.js";
import { scenarioDescriptions, type Scenario } from "../../shared/schemas/scenario.js";
import type { Player, ChatMessage, Game, StreamResult, EndpointPreset } from "../../shared/index.js";

class App {
  private gameId: string | null = null;
  private dmPanel: HTMLElement | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    this.gameId = urlParams.get("game");

    wsManager.connect();
    this.setupWebSocketHandlers();

    if (this.gameId && !gameState.currentPlayer) {
      this.showJoinForm();
    } else {
      new CharacterCreator();
    }
  }

  private showJoinForm(): void {
    const races = ["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Half-Elf", "Gnome", "Half-Orc"].map(r => `<option value="${r}">${r}</option>`).join("");
    const classes = ["Fighter", "Wizard", "Rogue", "Cleric", "Barbarian", "Paladin", "Ranger", "Sorcerer"].map(c => `<option value="${c}">${c}</option>`).join("");

    document.getElementById("app")!.innerHTML = `
      <div class="welcome-screen">
        <div class="settings-trigger" title="LLM Settings">⚙️</div>
        <h2>Join Game</h2>
        <form id="join-form">
          <label>Player Name <input type="text" id="player-name" required></label>
          <label>Character Name <input type="text" id="character-name" required></label>
          <label>Race <select id="race">${races}</select></label>
          <label>Class <select id="character-class">${classes}</select></label>
          <h3>Attributes (3-18 each)</h3>
          <div class="attributes-grid">
            <label>STR <input type="number" id="attr-str" min="3" max="18" value="10"></label>
            <label>DEX <input type="number" id="attr-dex" min="3" max="18" value="10"></label>
            <label>CON <input type="number" id="attr-con" min="3" max="18" value="10"></label>
            <label>INT <input type="number" id="attr-int" min="3" max="18" value="10"></label>
            <label>WIS <input type="number" id="attr-wis" min="3" max="18" value="10"></label>
            <label>CHA <input type="number" id="attr-cha" min="3" max="18" value="10"></label>
          </div>
          <button type="submit" class="primary">Join Game</button>
        </form>
      </div>
    `;

    document.querySelector(".settings-trigger")?.addEventListener("click", () => this.showSettingsModal());

    document.getElementById("join-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      wsManager.send({
        type: "JOIN_GAME",
        payload: {
          gameId: this.gameId!,
          playerName: (document.getElementById("player-name") as HTMLInputElement).value.trim(),
          characterName: (document.getElementById("character-name") as HTMLInputElement).value.trim(),
          race: (document.getElementById("race") as HTMLSelectElement).value,
          characterClass: (document.getElementById("character-class") as HTMLSelectElement).value,
          attributes: {
            str: parseInt((document.getElementById("attr-str") as HTMLInputElement).value),
            dex: parseInt((document.getElementById("attr-dex") as HTMLInputElement).value),
            con: parseInt((document.getElementById("attr-con") as HTMLInputElement).value),
            int: parseInt((document.getElementById("attr-int") as HTMLInputElement).value),
            wis: parseInt((document.getElementById("attr-wis") as HTMLInputElement).value),
            cha: parseInt((document.getElementById("attr-cha") as HTMLInputElement).value),
          },
        },
      });
    });
  }

  private setupWebSocketHandlers(): void {
    wsManager.on("open", () => {
      if (this.gameId && !gameState.currentPlayer) this.showJoinForm();
    });

    wsManager.on("disconnect", () => {
      this.showNotification("Disconnected from server. Reconnecting...", "error");
    });

    wsManager.on("GAME_CREATED", (payload) => {
      const p = payload as { gameId: string; game: Game };
      this.gameId = p.gameId;
      gameState.setGame(p.game);
      const dmPlayer = p.game.players?.[0];
      if (dmPlayer) gameState.setCurrentPlayer(dmPlayer);
      window.history.replaceState({}, "", `?game=${this.gameId}`);
      this.showGameUI();
      this.showNotification(`Game created! Share: ${window.location.href}`, "success");
    });

    wsManager.on("PLAYER_JOINED", (payload) => {
      const p = payload as { gameState: Game; player: Player };
      gameState.setGame(p.gameState);
      if (p.player && !gameState.currentPlayer) gameState.setCurrentPlayer(p.player);
      this.showGameUI();
    });

    wsManager.on("STREAM_CHUNK", (payload) => {
      const p = payload as { content: string; isFinal: boolean };
      
      // Check if this is a status placeholder message or actual LLM chunk
      const isStatusMessage = p.content === "The DM considers your action..." || 
                              p.content === "The Dungeon Master prepares the world...";
      
      if (isStatusMessage) {
        // Clear buffer and show only status message temporarily
        gameState.clearStreamBuffer();
        gameState.updateStreamBuffer(p.content);
      } else {
        // Actual LLM chunk - accumulate into buffer
        gameState.updateStreamBuffer(p.content);
      }
      
      this.renderStreamBuffer();
    });

    wsManager.on("STREAM_END", (payload) => {
      const p = payload as { fullNarrative: string; structured: Game };
      gameState.clearStreamBuffer();
      
      // Clear the stream display element immediately
      const streamDisplay = document.getElementById("stream-display");
      if (streamDisplay) streamDisplay.innerHTML = "";
      
      // The backend already added the narrative to game.chatHistory, so just set the game state
      gameState.setGame(p.structured);
      
      this.renderChatMessages();
      this.renderHP();
    });

    wsManager.on("STREAM_ERROR", (payload) => {
      const p = payload as { message: string; fallbackNarrative: string };
      gameState.clearStreamBuffer();
      const isOffline = p.message.includes("unreachable") || p.message.includes("ECONNREFUSED");
      const content = isOffline
        ? `⚠️ DM unavailable — ${p.message}. Check that LM Studio is running and restart the server.`
        : p.fallbackNarrative || "The DM's voice fades...";
      gameState.addChatMessage({
        id: "stream-error",
        content,
        type: isOffline ? "error" : "narrative",
        timestamp: Date.now(),
      });
      this.renderChatMessages();
      this.showNotification(`DM error: ${p.message}`, "error");
    });

    wsManager.on("CHAT_MESSAGE", (payload) => {
      const p = payload as { message: ChatMessage; gameState: Game };
      
      // Use the full game state from backend to ensure consistency
      if (p.gameState) {
        gameState.setGame(p.gameState);
      } else {
        // Fallback for old format (single message only)
        const msg = p.message as ChatMessage;
        gameState.addChatMessage(msg);
      }
      
      this.renderChatMessages();
    });

    wsManager.on("NPC_CREATED", (payload) => {
      const p = payload as { npc: { name: string; description: string; role: string } };
      this.showNotification(`New NPC: ${this.escapeHtml(p.npc.name)} (${this.escapeHtml(p.npc.role)})`, "info");
    });

    wsManager.on("ERROR", (payload) => {
      const p = payload as { message: string };
      this.showNotification(`Error: ${p.message}`, "error");
    });
  }

  private showGameUI(): void {
    const game = gameState.game;
    const player = gameState.currentPlayer || game?.players?.[0];
    if (!game || !player) return;

    const scenarioLabel = (game.scenario as Scenario) ? `${scenarioDescriptions[game.scenario as Scenario].icon} ${scenarioDescriptions[game.scenario as Scenario].label}` : "Unknown";

    const container = document.getElementById("app");
    if (!container) return;

    container.innerHTML = `
      <div class="game-interface">
        <header class="game-header">
          <h2>${this.escapeHtml(game.name)}</h2>
          <span class="game-id">ID: ${this.escapeHtml(game.id)} • ${this.escapeHtml(scenarioLabel)}</span>
          <button id="settings-btn" title="LLM Settings">⚙️ Settings</button>
          <button id="copy-link-btn" title="Copy link">📋 Copy Link</button>
        </header>
        <div class="main-content">
          <aside class="players-panel">
            <h3>Players (${game.players?.length || 0}/${game.maxPlayers})</h3>
            <ul id="players-list">
              <!-- Dedicated DM Card -->
              <li class="dm-card">
                <span class="badge-dm">🧙 AI Dungeon Master</span>
                <div class="player-info">
                  <span class="character-name" style="color:var(--accent-gold)">Storyteller</span>
                  <span class="player-detail">${this.escapeHtml(scenarioLabel)}</span>
                </div>
                <div class="dm-status">
                  <span class="status-dot"></span> Active — ${game.players?.length || 0} player(s) in session
                </div>
              </li>

              <!-- Actual Players -->
              ${(game.players || []).map((p: Player) => `
                <li>
                  <div class="player-info">
                    <span class="character-name">${this.escapeHtml(p.characterName)}</span>
                    <span class="player-detail">${this.escapeHtml(p.race)} ${this.escapeHtml(p.characterClass)} Lv.${p.level}</span>
                  </div>
                  ${p.hp !== undefined && p.maxHp > 0 ? `
                    <div class="hp-bar-container">
                      <div class="hp-bar-track">
                        <div class="hp-bar-fill" style="width:${Math.round((p.hp / p.maxHp) * 100)}%;${p.hp <= Math.round(p.maxHp * 0.2) ? 'background:linear-gradient(90deg,#dc2626,#ef4444)' : ''}"></div>
                      </div>
                      <span class="hp-text">${p.hp}/${p.maxHp}</span>
                    </div>
                  ` : ''}
                </li>
              `).join("")}
            </ul>
          </aside>
          <main class="chat-area">
            <div id="chat-messages" class="chat-messages"></div>
            <div id="stream-display" class="stream-display"></div>
            <div id="action-container"></div>
          </main>
        </div>
      </div>
    `;

    // Load chat history
    (game.chatHistory || []).forEach((msg: ChatMessage) => this.appendChatMessage(msg));

    // Render HP
    this.renderHP();

    // Initialize action bar
    const actionContainer = document.getElementById("action-container");
    if (actionContainer) new ActionBar(actionContainer);

    // Copy link — event delegation on header for durability across DOM swaps
    document.querySelector(".game-header")?.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.id === "copy-link-btn") {
        navigator.clipboard.writeText(window.location.href).then(() => {
          this.showNotification("Link copied!", "success");
        });
      } else if (target.id === "settings-btn") {
        this.showSettingsModal();
      }
    });
  }

  private renderStreamBuffer(): void {
    const display = document.getElementById("stream-display");
    if (!display) return;
    
    // Parse the buffer to extract clean narrative (strips JSON block)
    const parsedNarrative = gameState.getParsedNarrative();
    
    display.innerHTML = `<div class="streaming"><span class="typing">${this.escapeHtml(parsedNarrative)}<span class="cursor">▊</span></span></div>`;
    display.scrollTop = display.scrollHeight;
  }

  private renderChatMessages(): void {
    const messagesDiv = document.getElementById("chat-messages");
    if (!messagesDiv) return;
    messagesDiv.innerHTML = "";
    (gameState.game?.chatHistory || []).forEach((msg: ChatMessage) => this.appendChatMessage(msg));
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  private renderHP(): void {
    const list = document.getElementById("players-list");
    if (!list || !gameState.game) return;
    const items = list.querySelectorAll("li");
    items.forEach((item, i) => {
      const player = gameState.game!.players[i];
      if (player?.hp !== undefined && player.maxHp > 0) {
        const fill = item.querySelector(".hp-bar-fill") as HTMLElement;
        const text = item.querySelector(".hp-text") as HTMLElement;
        if (fill) {
          const pct = Math.round((player.hp / player.maxHp) * 100);
          fill.style.width = `${pct}%`;
          if (player.hp <= Math.round(player.maxHp * 0.2)) {
            fill.style.background = "linear-gradient(90deg,#dc2626,#ef4444)";
          } else {
            fill.style.background = ""; // revert to CSS default gradient
          }
        }
        if (text) text.textContent = `${player.hp}/${player.maxHp}`;
      }
    });
  }

  private appendChatMessage(message: ChatMessage): void {
    const messagesDiv = document.getElementById("chat-messages");
    if (!messagesDiv) return;

    const el = document.createElement("div");
    const isDMNarrative = message.type === "narrative" || !message.playerName;
    const senderName = isDMNarrative ? "🧙 AI Dungeon Master" : (message.characterName || message.playerName || "Unknown");
    el.className = `message ${message.type} ${!isDMNarrative && message.playerId === gameState.currentPlayer?.id ? "own" : ""}`;
    el.innerHTML = `
      <div class="message-header">
        <strong class="${isDMNarrative ? 'dm-sender' : ''}">${this.escapeHtml(senderName)}</strong>
        <span class="timestamp">${new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <div class="message-content">${this.escapeHtml(message.content)}</div>
    `;
    messagesDiv.appendChild(el);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  private showNotification(text: string, type: "success" | "error" | "info"): void {
    const existing = document.querySelector(".notification");
    if (existing) existing.remove();

    const notif = document.createElement("div");
    notif.className = `notification notification-${type}`;
    notif.textContent = text;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 4000);
  }

  private escapeHtml(text: string): string {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ---- Settings Modal ----

  private async loadConfig(): Promise<{ llmBaseUrl: string; llmApiKey: string; llmModel: string }> {
    try {
      const response = await fetch("/api/config");
      if (!response.ok) throw new Error("Failed to load config");
      return response.json();
    } catch {
      return { llmBaseUrl: "http://localhost:1234/v1", llmApiKey: "", llmModel: "" };
    }
  }

  private async testConfig(config: { llmBaseUrl: string; llmApiKey: string; llmModel: string }): Promise<{ connected: boolean; message: string }> {
    try {
      const response = await fetch("/api/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error("Test failed");
      return response.json();
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  private async saveConfig(config: { llmBaseUrl: string; llmApiKey: string; llmModel: string }): Promise<boolean> {
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error("Save failed");
      const result = await response.json();
      return result.success === true;
    } catch {
      return false;
    }
  }

  private async fetchModels(url: string, apiKey: string): Promise<{ models: string[]; error: string | null }> {
    try {
      const params = new URLSearchParams({ url, key: apiKey });
      const response = await fetch(`/api/config/models?${params}`);
      if (!response.ok) throw new Error("Failed to fetch models");
      return response.json();
    } catch (error) {
      return { models: [], error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  private showSettingsModal(): void {
    const presets = endpointPresets.map((p, i) => `<option value="${i}">${p.name}</option>`).join("");

    const modal = document.createElement("div");
    modal.className = "settings-modal";
    modal.innerHTML = `
      <div class="settings-overlay" data-action="close"></div>
      <div class="settings-panel">
        <div class="settings-header">
          <h3>⚙️ LLM Settings</h3>
          <button class="close-btn" data-action="close">✕</button>
        </div>
        <form id="settings-form">
          <label>
            Endpoint Preset
            <select id="preset-select">${presets}</select>
          </label>
          <label>
            API URL
            <input type="text" id="config-url" placeholder="http://localhost:1234/v1" required>
          </label>
          <label>
            API Key
            <input type="password" id="config-key" placeholder="Leave empty for local models">
          </label>
          <label>
            Model
            <select id="config-model-select"><option value="">— Fetch models —</option></select>
            <small id="model-status" style="color:#888;font-size:0.8rem;margin-top:4px;display:block">Enter URL & key, then click "Fetch Models"</small>
          </label>
          <div class="settings-actions">
            <button type="button" id="fetch-models-btn" class="secondary">Fetch Models</button>
            <button type="button" id="test-btn" class="secondary">Test Connection</button>
            <button type="submit" class="primary">Save</button>
          </div>
          <div id="settings-result" class="settings-result"></div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const urlInput = document.getElementById("config-url") as HTMLInputElement;
    const keyInput = document.getElementById("config-key") as HTMLInputElement;
    const modelSelect = document.getElementById("config-model-select") as HTMLSelectElement;
    const modelStatus = document.getElementById("model-status") as HTMLInputElement | null;

    // Load current config and auto-fetch models
    this.loadConfig().then(async config => {
      urlInput.value = config.llmBaseUrl;
      keyInput.value = config.llmApiKey;
      // Auto-fetch models using current config
      await this.autoFetchModels(config.llmBaseUrl, config.llmApiKey, modelSelect, modelStatus);
      // If a model is already saved, select it
      if (config.llmModel && modelSelect.querySelector(`option[value="${config.llmModel}"]`)) {
        modelSelect.value = config.llmModel;
      }
    });

    // Preset selection → auto fetch models
    document.getElementById("preset-select")?.addEventListener("change", async (e) => {
      const idx = parseInt((e.target as HTMLSelectElement).value);
      const preset = endpointPresets[idx];
      if (preset) {
        urlInput.value = preset.url;
        keyInput.value = preset.apiKey;
        modelSelect.innerHTML = '<option value="">— Fetch models —</option>';
        if (modelStatus) modelStatus.textContent = 'Enter URL & key, then click "Fetch Models"';
        if (preset.url && preset.apiKey) {
          await this.autoFetchModels(urlInput.value, keyInput.value, modelSelect, modelStatus);
        }
      }
    });

    // Fetch models
    document.getElementById("fetch-models-btn")?.addEventListener("click", async () => {
      const result = await this.autoFetchModels(urlInput.value, keyInput.value, modelSelect, modelStatus);
    });

    // Test connection
    document.getElementById("test-btn")?.addEventListener("click", async () => {
      const config = {
        llmBaseUrl: urlInput.value.trim(),
        llmApiKey: keyInput.value.trim(),
        llmModel: modelSelect.value,
      };
      const result = await this.testConfig(config);
      const resultDiv = document.getElementById("settings-result");
      if (resultDiv) {
        resultDiv.className = `settings-result ${result.connected ? "success" : "error"}`;
        resultDiv.textContent = result.connected ? "✅ Connected!" : `❌ ${result.message}`;
      }
    });

    // Save
    document.getElementById("settings-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const config = {
        llmBaseUrl: urlInput.value.trim(),
        llmApiKey: keyInput.value.trim(),
        llmModel: modelSelect.value,
      };
      const saved = await this.saveConfig(config);
      const resultDiv = document.getElementById("settings-result");
      if (resultDiv) {
        resultDiv.className = `settings-result ${saved ? "success" : "error"}`;
        resultDiv.textContent = saved ? "✅ Saved! Restart server to apply." : "❌ Save failed";
      }
    });

    // Close
    modal.querySelectorAll("[data-action='close']").forEach(btn => {
      btn.addEventListener("click", () => modal.remove());
    });
  }

  private async autoFetchModels(
    url: string,
    apiKey: string,
    modelSelect: HTMLSelectElement,
    statusEl: HTMLElement | null
  ): Promise<{ models: string[]; error: string | null }> {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      if (statusEl) statusEl.textContent = "Enter an API URL first";
      return { models: [], error: "No URL" };
    }

    if (statusEl) statusEl.textContent = "Fetching models...";
    modelSelect.innerHTML = '<option value="">— Loading —</option>';

    const result = await this.fetchModels(trimmedUrl, apiKey.trim());

    if (result.error) {
      if (statusEl) statusEl.textContent = `❌ ${result.error}`;
      modelSelect.innerHTML = '<option value="">— Failed —</option>';
      return result;
    }

    if (result.models.length === 0) {
      if (statusEl) statusEl.textContent = "No models found at this endpoint";
      modelSelect.innerHTML = '<option value="">— No models —</option>';
      return result;
    }

    modelSelect.innerHTML = '<option value="">— Select a model —</option>' +
      result.models.map(m => `<option value="${m}">${m}</option>`).join("");

    if (statusEl) statusEl.textContent = `✅ ${result.models.length} model(s) available`;
    return result;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  (window as unknown as { app: App }).app = new App();
});
