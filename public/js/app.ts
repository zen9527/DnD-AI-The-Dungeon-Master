// public/js/app.ts
import { wsManager } from "./websocket.js";
import { gameState } from "./game-state.js";
import { CharacterCreator } from "./character.js";
import { ActionBar } from "./action-bar.js";
import { initI18n, getLocale, setLocale, toSupportedLocale, t, SUPPORTED_LOCALES, getLocalizedScenarios } from "./i18n.js";
import { escapeHtml, showNotification, renderLocaleDropdownHTML, getLocaleDisplayName } from "./utils.js";
import { ChatView } from "./views/chat.js";
import { PlayersPanelView } from "./views/players-panel.js";
import { CombatPanelView } from "./views/combat-panel.js";
import { DMControlsView } from "./views/dm-controls.js";
import { InventoryPanelView } from "./views/inventory-panel.js";
import { SettingsModal } from "./views/settings-modal.js";
import { LobbyView } from "./views/lobby.js";
import type { Player, ChatMessage, Game, InitiativeEntry, Item } from "../../shared/index.js";

const ACTIVE_GAMES_REFRESH_MS = 30000;
/** Give the server a moment to answer an auto-join before falling back to the form. */
const AUTO_JOIN_TIMEOUT_MS = 3000;
const TIMER_WARNING_SECONDS = 10;
/** Marks a reload triggered by "Load", so the socket handler knows to auto-join. */
const RELOAD_FOR_LOAD_KEY = "app_reload_for_load";

/**
 * Top-level UI orchestration: owns the game id, wires WebSocket events to the
 * views, and builds the game shell. All rendering lives in `./views/*`.
 */
class App {
  private gameId: string | null = null;
  /** True while the stream area shows a status placeholder rather than narrative. */
  private streamShowsPlaceholder = false;

  private readonly chat = new ChatView();
  private readonly playersPanel = new PlayersPanelView();
  private readonly combatPanel = new CombatPanelView();
  private readonly dmControls = new DMControlsView();
  private readonly inventoryPanel = new InventoryPanelView();
  private readonly lobby = new LobbyView();

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    initI18n();

    this.gameId = new URLSearchParams(window.location.search).get("game");

    wsManager.connect();
    this.setupWebSocketHandlers();
    this.attachGlobalEventDelegation();

    // After a "Load" reload the socket handler auto-joins; don't race it here.
    if (sessionStorage.getItem(RELOAD_FOR_LOAD_KEY) === "true") return;

    if (this.gameId && !gameState.currentPlayer) {
      this.showJoinForm();
      return;
    }

    new CharacterCreator();
    void this.fetchActiveGames();
    setInterval(() => void this.fetchActiveGames(), ACTIVE_GAMES_REFRESH_MS);
  }

  public async fetchActiveGames(): Promise<void> {
    try {
      const response = await fetch("/api/games");
      if (!response.ok) return;
      this.lobby.renderActiveGames(await response.json());
    } catch {
      // The API may not be up yet; the next refresh tick will retry.
    }
  }

  private showJoinForm(): void {
    if (!this.gameId) return;
    this.lobby.showJoinForm(this.gameId, () => new SettingsModal().show());
  }

  /**
   * Rejoin after a "Load"-triggered reload. The original character data is gone,
   * so a placeholder is used; if the game no longer exists, fall back to the form.
   */
  private autoJoinGame(): void {
    if (!this.gameId) return;

    wsManager.send({
      type: "JOIN_GAME",
      payload: {
        gameId: this.gameId,
        playerName: "Player",
        characterName: "Adventurer",
        race: "Human",
        characterClass: "Fighter",
        attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        locale: getLocale(),
      },
    });

    setTimeout(() => {
      if (!gameState.currentPlayer && document.querySelector(".welcome-screen")) {
        this.showJoinForm();
      }
    }, AUTO_JOIN_TIMEOUT_MS);
  }

  // ---- WebSocket wiring ----

  private setupWebSocketHandlers(): void {
    wsManager.on("open", () => {
      if (!this.gameId || gameState.currentPlayer) return;

      if (sessionStorage.getItem(RELOAD_FOR_LOAD_KEY) === "true") {
        sessionStorage.removeItem(RELOAD_FOR_LOAD_KEY);
        this.autoJoinGame();
        return;
      }

      this.showJoinForm();
    });

    wsManager.on("disconnect", () => {
      showNotification(t("disconnect.notification"), "error");
    });

    wsManager.on("GAME_CREATED", payload => {
      const p = payload as { gameId: string; game: Game };
      this.gameId = p.gameId;
      gameState.setGame(p.game);
      if (p.game.players?.[0]) gameState.setCurrentPlayer(p.game.players[0]);
      window.history.replaceState({}, "", `?game=${this.gameId}`);
      this.showGameUI();
      showNotification(t("game_created.notification", { url: window.location.href }), "success");
    });

    wsManager.on("PLAYER_JOINED", payload => {
      const p = payload as { gameState: Game; player: Player };
      gameState.setGame(p.gameState);
      if (p.player && !gameState.currentPlayer) gameState.setCurrentPlayer(p.player);
      this.showGameUI();
    });

    wsManager.on("STREAM_CHUNK", payload => {
      const p = payload as { content: string; isFinal: boolean; isStatus?: boolean };

      // Chunks are deltas — they must accumulate. The one exception is the
      // "DM is thinking" placeholder, which stands alone and is replaced by
      // the first real token.
      if (p.isStatus) {
        gameState.clearStreamBuffer();
        this.streamShowsPlaceholder = true;
      } else if (this.streamShowsPlaceholder) {
        gameState.clearStreamBuffer();
        this.streamShowsPlaceholder = false;
      }

      gameState.updateStreamBuffer(p.content);
      this.chat.renderStream();
    });

    wsManager.on("STREAM_END", payload => {
      const p = payload as { fullNarrative: string; structured: Game };
      gameState.clearStreamBuffer();
      this.chat.clearStream();
      // The server already appended the narrative to chatHistory.
      gameState.setGame(p.structured);
      this.chat.render();
      this.playersPanel.updateHP();
    });

    wsManager.on("STREAM_ERROR", payload => {
      const p = payload as { message: string; fallbackNarrative: string };
      gameState.clearStreamBuffer();
      this.chat.clearStream();

      const isOffline = p.message.includes("unreachable") || p.message.includes("ECONNREFUSED");
      gameState.addChatMessage({
        id: "stream-error",
        content: isOffline
          ? t("dm_offline.notification", { message: p.message })
          : p.fallbackNarrative || t("stream_error.fallback"),
        type: isOffline ? "error" : "narrative",
        timestamp: Date.now(),
      } as ChatMessage);

      this.chat.render();
      showNotification(t("dm_error.notification", { message: p.message }), "error");
    });

    wsManager.on("CHAT_MESSAGE", payload => this.applyChatUpdate(payload));
    wsManager.on("EMOTE_MESSAGE", payload => this.applyChatUpdate(payload));

    wsManager.on("PRIVATE_MESSAGE", payload => {
      const p = payload as { message: ChatMessage; targetPlayerId?: string; senderPlayerId?: string };
      gameState.addChatMessage(p.message);
      this.chat.render();

      if (p.senderPlayerId) {
        const sender = gameState.game?.players.find(pl => pl.id === p.senderPlayerId);
        showNotification(t("private_chat.received", { senderName: sender?.characterName || t("player.unknown") }), "info");
      } else if (p.targetPlayerId) {
        const target = gameState.game?.players.find(pl => pl.id === p.targetPlayerId);
        showNotification(t("private_chat.sent", { targetName: target?.characterName || t("player.unknown") }), "info");
      }
    });

    wsManager.on("NPC_CREATED", payload => {
      const p = payload as { npc: { name: string; role: string } };
      showNotification(t("npc_created.notification", { name: p.npc.name, role: p.npc.role }), "info");
    });

    wsManager.on("ERROR", payload => {
      showNotification(t("error.notification", { message: (payload as { message: string }).message }), "error");
    });

    wsManager.on("TURN_TIMER", payload => {
      const p = payload as { remaining: number; currentPlayerId: string; characterName?: string; expired?: boolean };
      gameState.setTimerState(p);

      const timerEl = document.getElementById("turn-timer");
      if (!timerEl) return;

      timerEl.textContent = `${p.remaining}s`;
      timerEl.classList.remove("warning", "expired");

      if (p.expired) {
        timerEl.classList.add("expired");
        showNotification(t("timer.expired", { name: p.characterName || t("player.unknown") }), "warning");
      } else if (p.remaining <= TIMER_WARNING_SECONDS) {
        timerEl.classList.add("warning");
      }
    });

    wsManager.on("COMBAT_STATE", payload => {
      const p = payload as {
        combatMode: boolean;
        initiativeOrder: InitiativeEntry[];
        currentRound: number;
        currentTurnIndex: number;
        currentPlayerName?: string;
      };
      gameState.setCombatState(p);

      if (p.combatMode) {
        this.combatPanel.show();
        this.combatPanel.render();
        showNotification(t("combat.started"), "info");
      } else {
        this.combatPanel.hide();
        showNotification(t("combat.ended"), "info");
      }

      const turnInfo = document.querySelector(".turn-info .current-turn");
      if (turnInfo) turnInfo.textContent = p.currentPlayerName || this.getCurrentPlayerName();
    });

    wsManager.on("INITIATIVE_UPDATE", payload => {
      const p = payload as { initiativeOrder: InitiativeEntry[]; newEntry: { entityId: string; score: number } };
      gameState.setInitiativeOrder(p.initiativeOrder);
      this.combatPanel.render();
      showNotification(t("initiative.rolled_for", { name: p.newEntry.entityId, score: p.newEntry.score }), "info");
    });

    wsManager.on("DM_CONTROL_UPDATE", payload => {
      const p = payload as { action: string; gameState?: Game; [key: string]: unknown };
      if (p.gameState) gameState.setGame(p.gameState);

      this.dmControls.refresh();
      this.playersPanel.updateHP();
      this.notifyDMControlAction(p);
    });

    wsManager.on("INVENTORY_UPDATE", payload => {
      const p = payload as { playerId: string; action: string; item?: Item };
      this.inventoryPanel.refresh();
      showNotification(
        p.item ? t("inventory.item_added", { name: p.item.name }) : t("inventory.item_removed", { name: "" }),
        "info"
      );
    });

    wsManager.on("EQUIPMENT_UPDATE", payload => {
      const p = payload as { playerId: string; slot: string; itemId: string | null };
      this.inventoryPanel.refresh();
      showNotification(t(p.itemId ? "equipment.equipped" : "equipment.unequipped", { slot: p.slot }), "info");
    });

    wsManager.on("ITEM_USED", () => {
      this.inventoryPanel.refresh();
      showNotification(t("inventory.item_used"), "info");
    });

    wsManager.on("GAME_SAVED", () => {
      showNotification(t("save.success"), "success");
    });
  }

  /** CHAT_MESSAGE and EMOTE_MESSAGE both carry the authoritative game state. */
  private applyChatUpdate(payload: unknown): void {
    const p = payload as { message: ChatMessage; gameState?: Game };
    if (p.gameState) {
      gameState.setGame(p.gameState);
    } else {
      gameState.addChatMessage(p.message);
    }
    this.chat.render();
  }

  private notifyDMControlAction(p: { action: string; [key: string]: unknown }): void {
    const players = gameState.game?.players || [];
    const named = (id: unknown) => players.find(pl => pl.id === id)?.characterName || String(id);

    switch (p.action) {
      case "npc_delete":
        showNotification(t("dm_control.npc_deleted", { name: String(p.npcId) }), "info");
        break;
      case "player_award_xp":
        showNotification(t("dm_control.xp_awarded", { amount: Number(p.amount), playerName: named(p.playerId) }), "success");
        break;
      case "player_level_up": {
        const player = players.find(pl => pl.id === p.playerId);
        showNotification(t("dm_control.player_leveled", { playerName: named(p.playerId), level: player?.level || 1 }), "success");
        break;
      }
    }
  }

  // ---- Game shell ----

  private showGameUI(): void {
    const game = gameState.game;
    const player = gameState.currentPlayer || game?.players?.[0];
    const container = document.getElementById("app");
    if (!game || !player || !container) return;

    this.gameId = game.id;

    const scenarios = getLocalizedScenarios();
    const scenario = scenarios[game.scenario] || scenarios.dungeon;
    const scenarioLabel = `${scenario.icon} ${scenario.label}`;

    container.innerHTML = `
      <div class="game-interface">
        ${renderLocaleDropdownHTML(SUPPORTED_LOCALES, getLocale(), getLocaleDisplayName)}
        <header class="game-header">
          <h2>${escapeHtml(game.name)}</h2>
          <div class="turn-info">
            <span class="current-turn">${escapeHtml(this.getCurrentPlayerName())}</span>
            <span class="timer" id="turn-timer">60s</span>
          </div>
          <span class="game-id">ID: ${escapeHtml(game.id)} • ${escapeHtml(scenarioLabel)}</span>
          <div class="game-actions">
            <button id="save-game-btn" class="secondary">💾 ${t("save.btn")}</button>
            <button id="load-game-btn" class="secondary">📂 ${t("load.btn")}</button>
          </div>
          <button id="settings-btn" title="${t("settings.title")}">⚙️ ${t("settings.save_btn")}</button>
          <button id="copy-link-btn" title="${t("copy_link.tooltip")}">📋</button>
        </header>
        <div class="main-content">
          <aside class="players-panel">${this.playersPanel.render(scenarioLabel)}</aside>
          <main class="chat-area">
            <div id="chat-messages" class="chat-messages"></div>
            <div id="stream-display" class="stream-display"></div>
            <div id="action-container"></div>
          </main>
          <aside class="combat-panel hidden" id="combat-panel"></aside>
          <aside class="combat-panel hidden" id="inventory-panel"></aside>
        </div>
        ${player.isDM ? `<div class="dm-control-panel-expanded hidden" id="dm-control-panel"></div>` : ""}
      </div>
    `;

    this.chat.render();
    this.playersPanel.updateHP();
    this.inventoryPanel.render();

    if (gameState.combatMode) {
      this.combatPanel.show();
      this.combatPanel.render();
    }

    const actionContainer = document.getElementById("action-container");
    if (actionContainer) new ActionBar(actionContainer);

    this.dmControls.setupToggle();
    this.bindGameHeaderEvents();
  }

  private bindGameHeaderEvents(): void {
    document.getElementById("locale-select")?.addEventListener("change", event => {
      const newLocale = toSupportedLocale((event.target as HTMLSelectElement).value);
      setLocale(newLocale);
      wsManager.send({ type: "SET_LOCALE", payload: { locale: newLocale } });
      location.reload();
    });

    document.getElementById("save-game-btn")?.addEventListener("click", () => {
      if (!this.gameId) return;
      wsManager.send({ type: "SAVE_GAME", payload: { gameId: this.gameId } });
      showNotification(t("save.saving"), "info");
    });

    document.getElementById("load-game-btn")?.addEventListener("click", async () => {
      if (!this.gameId) return;

      try {
        const response = await fetch(`/api/games/${this.gameId}/load`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          showNotification(data.error || t("load.error"), "error");
          return;
        }

        showNotification(t("load.success"), "success");
        // The socket handler auto-joins once the page comes back up.
        sessionStorage.setItem(RELOAD_FOR_LOAD_KEY, "true");
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        showNotification(t("load.error"), "error");
        console.error("Load failed:", error);
      }
    });
  }

  /**
   * Delegated clicks for controls that survive DOM swaps. Attached once to
   * document.body so re-rendering the shell never drops these handlers.
   */
  private attachGlobalEventDelegation(): void {
    document.body.addEventListener("click", event => {
      const target = event.target as HTMLElement;

      if (target.id === "settings-btn") {
        new SettingsModal().show();
        return;
      }

      if (target.id === "copy-link-btn") {
        void navigator.clipboard.writeText(window.location.href).then(() => {
          showNotification(t("link_copied.notification"), "success");
        });
        return;
      }

      // Settings modal dismissal: the ✕ button or a click on the backdrop.
      const closeTarget = target.closest("[data-action='close']");
      if (closeTarget) {
        closeTarget.closest(".settings-modal")?.remove();
        return;
      }

      if (target.classList.contains("settings-overlay")) {
        target.parentElement?.remove();
      }
    });
  }

  private getCurrentPlayerName(): string {
    const player = gameState.currentPlayer;
    return player?.characterName || player?.name || t("player.unknown");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  (window as unknown as { app: App }).app = new App();
});
