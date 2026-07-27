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
import type { Player, ChatMessage, DiceRoll, Game, InitiativeEntry, Item } from "../../shared/index.js";

const ACTIVE_GAMES_REFRESH_MS = 30000;
/** Give the server a moment to answer an auto-join before falling back to the form. */
const AUTO_JOIN_TIMEOUT_MS = 3000;
const TIMER_WARNING_SECONDS = 10;
/** Rejoin tokens, keyed by game id, so a refresh reclaims your seat. */
const PLAYER_TOKENS_KEY = "dnd-player-tokens";

function readPlayerToken(gameId: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(PLAYER_TOKENS_KEY) || "{}") as Record<string, string>)[gameId] ?? null;
  } catch {
    return null;
  }
}

function writePlayerToken(gameId: string, token: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(PLAYER_TOKENS_KEY) || "{}") as Record<string, string>;
    all[gameId] = token;
    localStorage.setItem(PLAYER_TOKENS_KEY, JSON.stringify(all));
  } catch {
    // Private browsing or a full quota — rejoin degrades to the join form.
  }
}

function clearPlayerToken(gameId: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(PLAYER_TOKENS_KEY) || "{}") as Record<string, string>;
    delete all[gameId];
    localStorage.setItem(PLAYER_TOKENS_KEY, JSON.stringify(all));
  } catch {
    // Nothing to clean up.
  }
}

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

    // With a game in the URL, the socket handler decides between rejoining an
    // existing seat and showing the join form once the connection is open.
    if (this.gameId) return;

    new CharacterCreator(() => void this.fetchActiveGames());
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

  // ---- WebSocket wiring ----

  private setupWebSocketHandlers(): void {
    wsManager.on("open", () => {
      if (!this.gameId || gameState.currentPlayer) return;

      // A stored token means we already have a character in this game — take
      // the seat back instead of building a new one.
      const token = readPlayerToken(this.gameId);
      if (token) {
        wsManager.send({ type: "REJOIN_GAME", payload: { gameId: this.gameId, playerToken: token } });
        return;
      }

      this.showJoinForm();
    });

    wsManager.on("disconnect", () => {
      showNotification(t("disconnect.notification"), "error");
    });

    wsManager.on("GAME_CREATED", payload => {
      const p = payload as { gameId: string; game: Game; playerToken?: string };
      this.gameId = p.gameId;
      if (p.playerToken) writePlayerToken(p.gameId, p.playerToken);
      gameState.setGame(p.game);
      if (p.game.players?.[0]) gameState.setCurrentPlayer(p.game.players[0]);
      window.history.replaceState({}, "", `?game=${this.gameId}`);
      this.showGameUI();
      showNotification(t("game_created.notification", { url: window.location.href }), "success");
    });

    wsManager.on("PLAYER_JOINED", payload => {
      const p = payload as { gameId?: string; gameState: Game; player: Player; playerToken?: string };
      if (p.playerToken && p.gameId) writePlayerToken(p.gameId, p.playerToken);
      gameState.setGame(p.gameState);
      if (p.player && !gameState.currentPlayer) gameState.setCurrentPlayer(p.player);
      this.showGameUI();
    });

    wsManager.on("GAME_REJOINED", payload => {
      const p = payload as { gameId: string; gameState: Game; player: Player };
      this.gameId = p.gameId;
      gameState.setGame(p.gameState);
      gameState.setCurrentPlayer(p.player);
      this.showGameUI();
      showNotification(t("rejoin.success", { name: p.player.characterName }), "success");
    });

    wsManager.on("REJOIN_FAILED", payload => {
      // The token outlived its game (or the server restarted). Forget it and
      // let the player make a character rather than stranding them.
      const p = payload as { gameId: string };
      clearPlayerToken(p.gameId);
      showNotification(t("rejoin.expired"), "warning");
      this.showJoinForm();
    });

    wsManager.on("PLAYER_LEFT", payload => {
      const p = payload as { gameState?: Game };
      if (p.gameState) gameState.setGame(p.gameState);
      this.playersPanel.updateHP();
    });

    wsManager.on("GAME_LOADED", payload => {
      const p = payload as { gameState: Game };
      gameState.setGame(p.gameState);
      this.showGameUI();
      showNotification(t("load.success"), "success");
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

    wsManager.on("DICE_ROLL_RESULT", payload => {
      const p = payload as { result: DiceRoll };
      // Manual rolls aren't part of server-side chat history, so each client
      // appends its own copy — it's a transient table event, not story state.
      gameState.addChatMessage({
        id: p.result.id,
        playerId: p.result.playerId,
        playerName: p.result.playerName,
        characterName: p.result.characterName,
        content: "",
        type: "roll",
        timestamp: p.result.timestamp,
        diceResult: p.result,
      });
      this.chat.render();
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
          <div class="header-identity">
            <h2>${escapeHtml(game.name)}</h2>
            <span class="game-id">${escapeHtml(scenarioLabel)} • ${escapeHtml(game.id)}</span>
          </div>
          <div class="turn-info">
            <span class="turn-label">${t("turn.label")}</span>
            <span class="current-turn">${escapeHtml(this.getCurrentPlayerName())}</span>
            <span class="timer" id="turn-timer">60s</span>
          </div>
          <div class="game-actions">
            <button id="inventory-btn" class="secondary" title="${t("inventory.title")}">
              <span class="btn-icon" aria-hidden="true">🎒</span><span class="btn-label">${t("inventory.short")}</span>
            </button>
            <button id="save-game-btn" class="secondary" title="${t("save.btn")}">
              <span class="btn-icon" aria-hidden="true">💾</span><span class="btn-label">${t("save.btn")}</span>
            </button>
            <button id="load-game-btn" class="secondary" title="${t("load.btn")}">
              <span class="btn-icon" aria-hidden="true">📂</span><span class="btn-label">${t("load.btn")}</span>
            </button>
            <button id="settings-btn" class="secondary icon-only" title="${t("settings.title")}">
              <span class="btn-icon" aria-hidden="true">⚙️</span>
            </button>
            <button id="copy-link-btn" class="secondary icon-only" title="${t("copy_link.tooltip")}">
              <span class="btn-icon" aria-hidden="true">🔗</span>
            </button>
          </div>
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
      // Views render from state, so a rebuild is enough — a full page reload
      // would drop the socket and the scroll position for nothing.
      this.showGameUI();
    });

    document.getElementById("save-game-btn")?.addEventListener("click", () => {
      if (!this.gameId) return;
      wsManager.send({ type: "SAVE_GAME", payload: { gameId: this.gameId } });
      showNotification(t("save.saving"), "info");
    });

    document.getElementById("load-game-btn")?.addEventListener("click", () => {
      if (!this.gameId) return;
      // The server restores the save and broadcasts it; GAME_LOADED re-renders.
      wsManager.send({ type: "LOAD_GAME", payload: { gameId: this.gameId } });
    });

    // The inventory panel used to render into an aside that nothing ever
    // unhid, so a player's pack was unreachable. This is the way in.
    document.getElementById("inventory-btn")?.addEventListener("click", () => {
      const panel = document.getElementById("inventory-panel");
      if (!panel) return;

      const opening = panel.classList.contains("hidden");
      if (opening) this.inventoryPanel.render();
      panel.classList.toggle("hidden", !opening);
      document.getElementById("inventory-btn")?.classList.toggle("active", opening);
    });
  }

  /**
   * Delegated clicks for controls that survive DOM swaps. Attached once to
   * document.body so re-rendering the shell never drops these handlers.
   */
  private attachGlobalEventDelegation(): void {
    document.body.addEventListener("click", event => {
      const clicked = event.target as HTMLElement;
      // The header buttons wrap their icon and label in spans, so the click
      // target is usually the span rather than the button itself.
      const target = (clicked.closest("button") as HTMLElement | null) ?? clicked;

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

// Deliberately not `window.app`: `<div id="app">` already claims that global,
// so anything reading `window.app` before this line runs gets the element and
// dies calling a method on it — which is how the lobby's game list once
// silently stopped rendering.
document.addEventListener("DOMContentLoaded", () => {
  (window as unknown as { dndApp: App }).dndApp = new App();
});
