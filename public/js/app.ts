// public/js/app.ts
import { wsManager } from "./websocket.js";
import { gameState } from "./game-state.js";
import { CharacterCreator } from "./character.js";
import { ActionBar } from "./action-bar.js";
import { initI18n, getLocale, setLocale, t, SUPPORTED_LOCALES, getLocalizedScenarios } from "./i18n.js";
import { endpointPresets } from "../../shared/schemas/config.js";
import { scenarioDescriptions, type Scenario } from "../../shared/schemas/scenario.js";
import type { Player, ChatMessage, Game, StreamResult, EndpointPreset, DiceRoll } from "../../shared/index.js";

/**
 * Format dice roll result for chat display
 */
function formatDiceResult(dice: DiceRoll, locale: string): string {
  if (!dice.skillCheck) {
    return `🎲 d20: ${dice.total} (${dice.rolls[0] || dice.total} + ${dice.modifier})`;
  }

  const roll = dice.rolls[0] || dice.total;
  const mod = dice.modifier;
  const total = dice.total;
  const resultText = dice.skillCheck.success ? "success" : "failure";
  
  // Localized skill names for Chinese
  let skillName = dice.skillCheck.skill;
  if (locale === "zh-CN") {
    const skillMap: Record<string, string> = {
      "Stealth": "潜行",
      "Perception": "察觉",
      "Persuasion": "说服",
      "Intimidation": "威吓",
      "Investigation": "调查",
      "Arcana": "奥秘",
      "Athletics": "运动",
      "Dodge": "闪避",
      "Attack": "攻击"
    };
    skillName = skillMap[dice.skillCheck.skill] || dice.skillCheck.skill;
  }

  return `🎲 ${skillName} 检定：${total} (${roll} + ${mod}) - ${t(`dice.${resultText}`)} (DC ${dice.skillCheck.dc})`;
}

class App {
  private gameId: string | null = null;
  private dmPanel: HTMLElement | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Initialize i18n — restore locale from localStorage
    initI18n();

    const urlParams = new URLSearchParams(window.location.search);
    this.gameId = urlParams.get("game");

    wsManager.connect();
    this.setupWebSocketHandlers();
    this.attachGlobalEventDelegation(); // once — covers settings, copy-link, modal close

    if (this.gameId && !gameState.currentPlayer) {
      this.showJoinForm();
    } else {
      new CharacterCreator();
      this.fetchActiveGames();
      // Auto-refresh active games every 30 seconds
      setInterval(() => this.fetchActiveGames(), 30000);
    }
  }

  public async fetchActiveGames(): Promise<void> {
    try {
      const response = await fetch("/api/games");
      if (!response.ok) return;
      const games: Array<{ id: string; name: string; scenario: string; players: number; maxPlayers: number }> = await response.json();
      this.renderActiveGames(games);
    } catch {
      // If API not ready yet, skip — will refresh on next connection
    }
  }

  private renderActiveGames(games: Array<{ id: string; name: string; scenario: string; players: number; maxPlayers: number }>): void {
    const container = document.getElementById("active-games-container");
    if (!container) return;

    if (games.length === 0) {
      container.innerHTML = `
        <div class="no-games">
          <span class="no-games-icon">${t("active_games.no_games.icon")}</span>
          <p>${t("active_games.no_games.text")}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = games.map(g => {
      const localizedScenarios = getLocalizedScenarios();
      const desc = localizedScenarios[g.scenario] || localizedScenarios.dungeon;
      const isFull = g.players >= g.maxPlayers;
      const statusClass = isFull ? "status-full" : "status-open";
      const statusText = isFull ? t("active_games.full") : t("active_games.players", { current: g.players, max: g.maxPlayers });

      return `
        <div class="game-card ${isFull ? 'full' : ''}" data-game-id="${this.escapeHtml(g.id)}">
          <div class="game-card-header">
            <span class="scenario-badge">${desc.icon}</span>
            <h3>${this.escapeHtml(g.name)}</h3>
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
          <div class="game-card-body">
            <span class="game-scenario-label">${desc.label}</span>
            <button class="join-game-btn ${isFull ? 'disabled' : ''}" data-game-id="${this.escapeHtml(g.id)}" ${isFull ? 'disabled' : ''}>
              ${isFull ? t("active_games.full") : t("active_games.join")}
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Attach join handlers to game cards and buttons
    container.querySelectorAll(".game-card[data-game-id], .join-game-btn:not(.disabled)").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const gameId = el.getAttribute("data-game-id");
        if (gameId && !el.classList.contains("disabled")) {
          window.location.href = `?game=${gameId}`;
        }
      });
    });
  }

  private showJoinForm(): void {
    const races = raceOptions.map(r => `<option value="${r}">${t(`race.${r.toLowerCase()}`)}</option>`).join("");
    const classes = classOptions.map(c => `<option value="${c}">${t(`class.${c.toLowerCase()}`)}</option>`).join("");

    document.getElementById("app")!.innerHTML = `
      <div class="welcome-screen">
        ${this.renderLocaleDropdown()}
        <div class="settings-trigger" title="${t("settings.title")}">⚙️</div>
        <h2>${t("join_game_page.title")}</h2>
        <form id="join-form">
          <label>${t("player_name.label")} <input type="text" id="player-name" required></label>
          <label>${t("character_name.label")} <input type="text" id="character-name" required></label>
          <label>${t("race.label")} <select id="race">${races}</select></label>
          <label>${t("class.label")} <select id="character-class">${classes}</select></label>
          <h3>${t("attributes.title")}</h3>
          <div class="attributes-grid">
            <label>${t("attributes.str")} <input type="number" id="attr-str" min="3" max="18" value="10"></label>
            <label>${t("attributes.dex")} <input type="number" id="attr-dex" min="3" max="18" value="10"></label>
            <label>${t("attributes.con")} <input type="number" id="attr-con" min="3" max="18" value="10"></label>
            <label>${t("attributes.int")} <input type="number" id="attr-int" min="3" max="18" value="10"></label>
            <label>${t("attributes.wis")} <input type="number" id="attr-wis" min="3" max="18" value="10"></label>
            <label>${t("attributes.cha")} <input type="number" id="attr-cha" min="3" max="18" value="10"></label>
          </div>
          <button type="submit" class="primary">${t("join_form.btn")}</button>
        </form>
      </div>
    `;

    document.querySelector(".settings-trigger")?.addEventListener("click", () => this.showSettingsModal());

    // Language selector change handler
    document.getElementById("locale-select")?.addEventListener("change", () => {
      const newLocale = (document.getElementById("locale-select") as HTMLSelectElement).value;
      setLocale(newLocale);
      location.reload();
    });

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
          locale: getLocale(),
        },
      });
    });
  }

  private renderLocaleDropdown(): string {
    const current = getLocale();
    return `<select id="locale-select" class="locale-selector">
      ${SUPPORTED_LOCALES.map(l => `<option value="${l}" ${l === current ? 'selected' : ''}>${this.getLocaleName(l)}</option>`).join("")}
    </select>`;
  }

  private getLocaleName(locale: string): string {
    const names: Record<string, string> = {
      "en-US": "English", "zh-CN": "简体中文", "ja-JP": "日本語", "es-ES": "Español", "ko-KR": "한국어",
    };
    return names[locale] || locale;
  }

  private setupWebSocketHandlers(): void {
    wsManager.on("open", () => {
      if (this.gameId && !gameState.currentPlayer) this.showJoinForm();
    });

    wsManager.on("disconnect", () => {
      this.showNotification(t("disconnect.notification"), "error");
    });

    wsManager.on("GAME_CREATED", (payload) => {
      const p = payload as { gameId: string; game: Game };
      this.gameId = p.gameId;
      gameState.setGame(p.game);
      const dmPlayer = p.game.players?.[0];
      if (dmPlayer) gameState.setCurrentPlayer(dmPlayer);
      window.history.replaceState({}, "", `?game=${this.gameId}`);
      this.showGameUI();
      this.showNotification(t("game_created.notification", { url: window.location.href }), "success");
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
      const isStatusMessage = p.content === t("status.dm_considers") || 
                              p.content === t("status.dm_preparing");
      
      if (isStatusMessage) {
        // Clear buffer completely and show only status message
        gameState.clearStreamBuffer();
        gameState.updateStreamBuffer(p.content);
      } else {
        // LLM chunk arrives - clear buffer completely then add content
        gameState.clearStreamBuffer();
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
        ? t("dm_offline.notification", { message: p.message })
        : p.fallbackNarrative || t("stream_error.fallback");
      gameState.addChatMessage({
        id: "stream-error",
        content,
        type: isOffline ? "error" : "narrative",
        timestamp: Date.now(),
      });
      this.renderChatMessages();
      this.showNotification(t("dm_error.notification", { message: p.message }), "error");
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

    wsManager.on("EMOTE_MESSAGE", (payload) => {
      const p = payload as { message: ChatMessage; gameState: Game };
      
      // Emote messages are styled differently - use full game state
      if (p.gameState) {
        gameState.setGame(p.gameState);
      } else {
        gameState.addChatMessage(p.message);
      }
      
      this.renderChatMessages();
    });

    wsManager.on("PRIVATE_MESSAGE", (payload) => {
      const p = payload as { message: ChatMessage; targetPlayerId?: string; senderPlayerId?: string };
      
      // Add private message to chat history
      gameState.addChatMessage(p.message);
      this.renderChatMessages();
      
      // Show notification
      if (p.senderPlayerId) {
        // Received private message
        const sender = gameState.game?.players.find(pl => pl.id === p.senderPlayerId);
        this.showNotification(t("private_chat.received", { senderName: sender?.characterName || "Unknown" }), "info");
      } else if (p.targetPlayerId) {
        // Sent private message confirmation
        const target = gameState.game?.players.find(pl => pl.id === p.targetPlayerId);
        this.showNotification(t("private_chat.sent", { targetName: target?.characterName || "Unknown" }), "info");
      }
    });

    wsManager.on("NPC_CREATED", (payload) => {
      const p = payload as { npc: { name: string; description: string; role: string } };
      this.showNotification(t("npc_created.notification", { name: this.escapeHtml(p.npc.name), role: this.escapeHtml(p.npc.role) }), "info");
    });

    wsManager.on("ERROR", (payload) => {
      const p = payload as { message: string };
      this.showNotification(t("error.notification", { message: p.message }), "error");
    });

    wsManager.on("TURN_TIMER", (payload) => {
      const p = payload as { 
        remaining: number; 
        currentPlayerId: string; 
        characterName?: string; 
        expired?: boolean 
      };
      
      // Update timer state in game state
      gameState.setTimerState(p);
      
      // Update timer display in UI
      const timerEl = document.getElementById("turn-timer");
      if (timerEl) {
        timerEl.textContent = `${p.remaining}s`;
        
        // Remove old classes
        timerEl.classList.remove("warning", "expired");
        
        // Add warning/expired classes based on state
        if (p.expired) {
          timerEl.classList.add("expired");
          this.showNotification(`⏰ ${p.characterName || 'Current player'}'s time is up!`, "warning");
        } else if (p.remaining <= 10) {
          timerEl.classList.add("warning");
        }
      }
    });

    wsManager.on("COMBAT_STATE", (payload) => {
      const p = payload as { 
        combatMode: boolean;
        initiativeOrder: Array<{ playerId?: string; npcId?: string; score: number; name: string; hp: number; maxHp: number; ac: number; isPlayer: boolean }>;
        currentRound: number;
        currentTurnIndex: number;
        currentPlayerName?: string;
      };
      
      // Update combat state in game state
      gameState.setCombatState(p);
      
      // Update UI to show/hide combat panel
      const combatPanel = document.getElementById("combat-panel");
      if (combatPanel) {
        if (p.combatMode) {
          combatPanel.classList.remove("hidden");
          this.renderCombatPanel();
          this.showNotification(t("combat.started"), "info");
        } else {
          combatPanel.classList.add("hidden");
          this.showNotification(t("combat.ended"), "info");
        }
      }
      
      // Update turn display
      const turnInfo = document.querySelector(".turn-info .current-turn");
      if (turnInfo) {
        turnInfo.textContent = p.currentPlayerName || this.getCurrentPlayerName();
      }
    });

    wsManager.on("INITIATIVE_UPDATE", (payload) => {
      const p = payload as { 
        initiativeOrder: Array<{ playerId?: string; npcId?: string; score: number; name: string; hp: number; maxHp: number; ac: number; isPlayer: boolean }>;
        newEntry: { entityId: string; score: number };
      };
      
      gameState.setInitiativeOrder(p.initiativeOrder);
      this.renderCombatPanel();
      this.showNotification(t("initiative.rolled_for", { name: p.newEntry.entityId, score: p.newEntry.score }), "info");
    });

    wsManager.on("DM_CONTROL_UPDATE", (payload) => {
      const p = payload as { 
        action: string;
        gameState: Game;
        [key: string]: unknown;
      };
      
      // Update game state
      if (p.gameState) {
        gameState.setGame(p.gameState);
      }
      
      // Refresh DM control panel if visible
      const panel = document.getElementById("dm-control-panel");
      if (panel) {
        this.renderDMControlPanel();
      }
      
      // Show notification based on action
      const player = gameState.currentPlayer;
      switch (p.action) {
        case "npc_delete":
          this.showNotification(t("dm_control.npc_deleted", { name: p.npcId }), "info");
          break;
        case "player_award_xp":
          if (player) {
            const targetPlayer = gameState.game.players?.find(pl => pl.id === p.playerId);
            this.showNotification(t("dm_control.xp_awarded", { amount: p.amount, playerName: targetPlayer?.characterName || p.playerId }), "success");
          }
          break;
        case "player_level_up":
          if (player) {
            const targetPlayer = gameState.game.players?.find(pl => pl.id === p.playerId);
            this.showNotification(t("dm_control.level_up", { playerName: targetPlayer?.characterName || p.playerId }), "success");
          }
          break;
        case "add_item":
          this.showNotification(t("inventory.item_added", { name: p.item?.name }), "info");
          break;
      }
    });

    wsManager.on("INVENTORY_UPDATE", (payload) => {
      const p = payload as { 
        playerId: string;
        action: string;
        item?: any;
      };
      
      // Update game state
      if (gameState.game) {
        gameState.setGame(gameState.game);
      }
      
      // Refresh inventory panel if visible
      const inventoryPanel = document.getElementById("inventory-panel");
      if (inventoryPanel) {
        this.renderInventoryPanel();
      }
      
      this.showNotification(t(`inventory.${p.action}`), "info");
    });

    wsManager.on("EQUIPMENT_UPDATE", (payload) => {
      const p = payload as { 
        playerId: string;
        slot: string;
        itemId: string | null;
      };
      
      // Update game state
      if (gameState.game) {
        gameState.setGame(gameState.game);
      }
      
      // Refresh inventory panel if visible
      const inventoryPanel = document.getElementById("inventory-panel");
      if (inventoryPanel) {
        this.renderInventoryPanel();
      }
      
      this.showNotification(t(`equipment.${p.itemId ? "equipped" : "unequipped"}`, { slot: p.slot }), "info");
    });

    wsManager.on("ITEM_USED", (payload) => {
      const p = payload as { 
        playerId: string;
        itemId: string;
        targetId?: string;
      };
      
      // Update game state
      if (gameState.game) {
        gameState.setGame(gameState.game);
      }
      
      // Refresh inventory panel if visible
      const inventoryPanel = document.getElementById("inventory-panel");
      if (inventoryPanel) {
        this.renderInventoryPanel();
      }
      
      this.showNotification(t("inventory.item_used"), "info");
    });

    wsManager.on("DM_CONTROL_UPDATE", (payload) => {
      const p = payload as { 
        action: string;
        gameState: Game;
        [key: string]: unknown;
      };
      
      // Update game state
      if (p.gameState) {
        gameState.setGame(p.gameState);
      }
      
      // Refresh DM control panel if visible
      const panel = document.getElementById("dm-control-panel");
      if (panel) {
        this.renderDMControlPanel();
      }
      
      // Show notification based on action
      const player = gameState.currentPlayer;
      switch (p.action) {
        case "npc_delete":
          this.showNotification(t("dm_control.npc_deleted", { name: p.npcId }), "info");
          break;
        case "player_award_xp":
          if (player) {
            const targetPlayer = gameState.game.players?.find(pl => pl.id === p.playerId);
            this.showNotification(t("dm_control.xp_awarded", { amount: p.amount, playerName: targetPlayer?.characterName || p.playerId }), "success");
          }
          break;
        case "player_level_up":
          if (player) {
            const targetPlayer = gameState.game.players?.find(pl => pl.id === p.playerId);
            this.showNotification(t("dm_control.player_leveled", { playerName: targetPlayer?.characterName || p.playerId, level: targetPlayer?.level || 1 }), "success");
          }
          break;
      }
    });
  }

  private showGameUI(): void {
    const game = gameState.game;
    const player = gameState.currentPlayer || game?.players?.[0];
    if (!game || !player) return;

    const localizedScenarios = getLocalizedScenarios();
    const scenarioDesc = localizedScenarios[game.scenario] || localizedScenarios.dungeon;
    const scenarioLabel = `${scenarioDesc.icon} ${scenarioDesc.label}`;

    const container = document.getElementById("app");
    if (!container) return;

    const dmStatusText = t("dm_status.active", { count: game.players?.length || 0 });

    container.innerHTML = `
      <div class="game-interface">
        ${this.renderLocaleDropdown()}
        <header class="game-header">
          <h2>${this.escapeHtml(game.name)}</h2>
          <div class="turn-info">
            <span class="current-turn">${this.escapeHtml(this.getCurrentPlayerName())}</span>
            <span class="timer" id="turn-timer">30s</span>
          </div>
          <span class="game-id">ID: ${this.escapeHtml(game.id)} • ${this.escapeHtml(scenarioLabel)}</span>
          <div class="game-actions">
            <button id="save-game-btn" class="secondary" title="${t("save.success")}">💾 Save</button>
            <button id="load-game-btn" class="secondary" title="${t("load.success")}">📂 Load</button>
          </div>
          <button id="settings-btn" title="${t("settings.title")}">⚙️ ${t("settings.save_btn")}</button>
          <button id="copy-link-btn" title="${t("copy_link.tooltip")}">📋</button>
        </header>
        <div class="main-content">
          <aside class="players-panel">
            <h3>${t("players.title")} (${game.players?.length || 0}/${game.maxPlayers})</h3>
            <ul id="players-list">
              <!-- Dedicated DM Card -->
              <li class="dm-card">
                <span class="badge-dm">${t("dm.name")}</span>
                <div class="player-info">
                  <span class="character-name" style="color:var(--accent-gold)">${t("dm.storyteller_name")}</span>
                  <span class="player-detail">${this.escapeHtml(scenarioLabel)}</span>
                </div>
                <div class="dm-status">
                  <span class="status-dot"></span> ${dmStatusText}
                </div>
              </li>

               <!-- Actual Players -->
                ${(game.players || []).map((p: Player) => {
                  const isCurrentPlayer = gameState.currentPlayer?.id === p.id;
                  
                  // Calculate XP threshold for next level (using shared constant)
                  const xpThresholds: Record<number, number> = {
                    1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500,
                    6: 14000, 7: 23000, 8: 34000, 9: 48000, 10: 64000,
                    11: 85000, 12: 100000, 13: 120000, 14: 140000, 15: 165000,
                    16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000
                  };
                  const nextLevelXP = xpThresholds[p.level + 1] || 355000;
                  const xpProgress = p.level < 20 ? Math.round((p.xp / nextLevelXP) * 100) : 100;
                  
                  return `
                    <li class="player-status ${isCurrentPlayer ? 'current-player' : ''}" data-player-id="${this.escapeHtml(p.id)}">
                      <div class="player-info">
                        <span class="character-name">${this.escapeHtml(p.characterName)}</span>
                        <span class="player-detail">${this.escapeHtml(p.race)} ${this.escapeHtml(p.characterClass)} ${t("level.abbreviation")}${p.level}</span>
                      </div>
                      ${p.hp !== undefined && p.maxHp > 0 ? `
                        <div class="hp-bar-container">
                          <div class="hp-bar-track">
                            <div class="hp-bar-fill ${p.hp > p.maxHp * 0.6 ? 'high' : p.hp > p.maxHp * 0.3 ? 'mid' : 'low'}" style="width:${Math.round((p.hp / p.maxHp) * 100)}%"></div>
                            <span class="hp-bar-text">❤ ${p.hp}/${p.maxHp}</span>
                          </div>
                        </div>
                      ` : ''}
                      <div class="xp-bar">
                        <span class="xp-text">XP: ${p.xp} / ${nextLevelXP}</span>
                        ${p.level < 20 ? `<span class="xp-progress">${xpProgress}%</span>` : '<span class="max-level">MAX LEVEL</span>'}
                      </div>
                    </li>
                  `;
                }).join("")}
            </ul>
          </aside>
          <main class="chat-area">
            <div id="chat-messages" class="chat-messages"></div>
            <div id="stream-display" class="stream-display"></div>
            <div id="action-container"></div>
          </main>
          <aside class="combat-panel hidden" id="combat-panel">
            <!-- Combat panel will be rendered by renderCombatPanel() -->
          </aside>
        </div>
        
        <!-- DM Control Panel (only visible to DM) -->
        ${player.isDM ? `
          <div class="dm-control-panel">
            <button id="start-combat-btn" class="primary">${t("combat.start")}</button>
            <button id="create-npc-btn" class="secondary">${t("npc.create_btn")}</button>
          </div>
        ` : ''}
      </div>
    `;

    // Load chat history
    (game.chatHistory || []).forEach((msg: ChatMessage) => this.appendChatMessage(msg));

    // Render HP
    this.renderHP();

    // Initialize combat panel if combat is active
    if (gameState.combatMode) {
      const combatPanel = document.getElementById("combat-panel");
      if (combatPanel) combatPanel.classList.remove("hidden");
      this.renderCombatPanel();
    }

    // Initialize action bar
    const actionContainer = document.getElementById("action-container");
    if (actionContainer) new ActionBar(actionContainer);

    // Setup DM controls
    this.setupDMControls();
    this.setupDMControlPanelToggle();

    // Language selector change handler (in-game)
    document.getElementById("locale-select")?.addEventListener("change", () => {
      const newLocale = (document.getElementById("locale-select") as HTMLSelectElement).value;
      setLocale(newLocale);
      // Send locale update to server (no reload needed for DM language)
      if (this.wsManager) {
        this.wsManager.send({ type: "SET_LOCALE", payload: { locale: newLocale } });
      }
      location.reload();
    });

    // Save game button
    const saveBtn = document.getElementById("save-game-btn");
    saveBtn?.addEventListener("click", async () => {
      if (!this.gameId) return;
      
      try {
        const response = await fetch(`/api/games/${this.gameId}/save`, { method: "POST" });
        const data = await response.json();
        
        if (response.ok && data.success) {
          this.showNotification(t("save.success"), "success");
        } else {
          this.showNotification(data.error || t("save.error"), "error");
        }
      } catch (error) {
        this.showNotification(t("save.error"), "error");
        console.error("Save failed:", error);
      }
    });

    // Load game button
    const loadBtn = document.getElementById("load-game-btn");
    loadBtn?.addEventListener("click", async () => {
      if (!this.gameId) return;
      
      try {
        const response = await fetch(`/api/games/${this.gameId}/load`);
        const data = await response.json();
        
        if (response.ok && data.success) {
          this.showNotification(t("load.success"), "success");
          // Reload page to apply loaded state
          setTimeout(() => window.location.reload(), 1000);
        } else {
          this.showNotification(data.error || t("load.error"), "error");
        }
      } catch (error) {
        this.showNotification(t("load.error"), "error");
        console.error("Load failed:", error);
      }
    });

  }

  // Event delegation — attached once on document body, survives all DOM swaps
  private attachGlobalEventDelegation(): void {
    if ((this as unknown as { _globalDelegated: boolean })._globalDelegated) return;
    (this as unknown as { _globalDelegated: boolean })._globalDelegated = true;

    document.body.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      // Settings button — in-game header or join form
      if (target.id === "settings-btn") {
        this.showSettingsModal();
        return;
      }

      // Copy link button
      if (target.id === "copy-link-btn") {
        navigator.clipboard.writeText(window.location.href).then(() => {
          this.showNotification(t("link_copied.notification"), "success");
        });
        return;
      }

      // Settings modal close — overlay or ✕ button
      const closeTarget = target.closest("[data-action='close']") as HTMLElement | null;
      if (closeTarget) {
        const modal = closeTarget.closest(".settings-modal") as HTMLElement | null;
        modal?.remove();
        return;
      }

      // Settings modal — clicking overlay closes it
      if (target.classList.contains("settings-overlay")) {
        target.parentElement?.remove();
        return;
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
    // Match by data-player-id attribute instead of index
    const items = list.querySelectorAll("li.player-status");
    items.forEach((item) => {
      const playerId = item.getAttribute("data-player-id");
      const player = gameState.game?.players.find(p => p.id === playerId);
      if (player?.hp !== undefined && player.maxHp > 0) {
        const fill = item.querySelector(".hp-bar-fill") as HTMLElement;
        const text = item.querySelector(".hp-bar-text") as HTMLElement;
        if (fill) {
          const pct = Math.round((player.hp / player.maxHp) * 100);
          fill.style.width = `${pct}%`;
          fill.classList.remove("high", "mid", "low");
          fill.classList.add(player.hp > player.maxHp * 0.6 ? "high" : player.hp > player.maxHp * 0.3 ? "mid" : "low");
        }
        if (text) text.textContent = `❤ ${player.hp}/${player.maxHp}`;
      }
    });
  }

  private appendChatMessage(message: ChatMessage): void {
    const messagesDiv = document.getElementById("chat-messages");
    if (!messagesDiv) return;

    const el = document.createElement("div");
    const isDMNarrative = message.type === "narrative" || !message.playerName;
    const isEmote = message.type === "emote";
    const senderName = isDMNarrative ? t("dm.name") : (message.characterName || message.playerName || t("player.unknown"));
    
    // Emote messages get special styling
    if (isEmote) {
      el.className = `message emote ${message.playerId === gameState.currentPlayer?.id ? "own" : ""}`;
    } else {
      el.className = `message ${message.type} ${!isDMNarrative && message.playerId === gameState.currentPlayer?.id ? "own" : ""}`;
    }
    
    // Build content - include dice result if present
    let content = this.escapeHtml(message.content);
    if (message.diceResult) {
      const locale = getLocale();
      const diceText = formatDiceResult(message.diceResult, locale);
      content += `<br><strong>${diceText}</strong>`;
    }

    el.innerHTML = `
      <div class="message-header">
        <strong class="${isDMNarrative ? 'dm-sender' : ''}">${this.escapeHtml(senderName)}</strong>
        <span class="timestamp">${new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <div class="message-content">${content}</div>
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

  private getCurrentPlayerName(): string {
    const player = gameState.currentPlayer;
    return player?.characterName || player?.name || "Unknown";
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
      return { connected: false, message: error instanceof Error ? error.message : t("error.unknown") };
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
      return { models: [], error: error instanceof Error ? error.message : t("error.unknown") };
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
          <h3>⚙️ ${t("settings.title")}</h3>
          <button class="close-btn" data-action="close">✕</button>
        </div>
        <form id="settings-form">
          <label>
            ${t("settings.endpoint_preset")}
            <select id="preset-select">${presets}</select>
          </label>
          <label>
            ${t("settings.api_url")}
            <input type="text" id="config-url" placeholder="http://localhost:1234/v1" required>
          </label>
          <label>
            ${t("settings.api_key")}
            <input type="password" id="config-key" placeholder="${t("settings.api_key_placeholder")}">
          </label>
          <label>
            ${t("settings.model")}
            <select id="config-model-select"><option value="">${t("settings.model_placeholder")}</option></select>
            <small id="model-status" style="color:#888;font-size:0.8rem;margin-top:4px;display:block">${t("settings.enter_url_key")}</small>
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

    document.body.appendChild(modal);

    const urlInput = document.getElementById("config-url") as HTMLInputElement;
    const keyInput = document.getElementById("config-key") as HTMLInputElement;
    const modelSelect = document.getElementById("config-model-select") as HTMLSelectElement;
    const modelStatus = document.getElementById("model-status") as HTMLInputElement | null;

    // Load current config and auto-fetch models
    this.loadConfig().then(async config => {
      urlInput.value = config.llmBaseUrl;
      keyInput.value = config.llmApiKey;
      // Sync preset dropdown to match saved URL, or fall back to Custom
      const presetIdx = endpointPresets.findIndex(p => p.url === config.llmBaseUrl);
      if (presetIdx >= 0) {
        (document.getElementById("preset-select") as HTMLSelectElement).value = String(presetIdx);
      } else {
        // URL doesn't match any preset — switch to Custom
        const customIdx = endpointPresets.findIndex(p => p.name === "Custom");
        if (customIdx >= 0) {
          (document.getElementById("preset-select") as HTMLSelectElement).value = String(customIdx);
        }
      }
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
        modelSelect.innerHTML = `<option value="">${t("settings.model_placeholder")}</option>`;
        if (modelStatus) modelStatus.textContent = t("settings.enter_url_key");
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
        resultDiv.textContent = result.connected ? t("settings.test_connected") : t("settings.test_error", { message: result.message });
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
        resultDiv.textContent = saved ? t("settings.save_success") : t("settings.save_error");
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
      if (statusEl) statusEl.textContent = t("settings.fetch_no_url");
      return { models: [], error: "No URL" };
    }

    if (statusEl) statusEl.textContent = t("settings.fetch_models.loading");
    modelSelect.innerHTML = `<option value="">${t("settings.loading_models")}</option>`;

    const result = await this.fetchModels(trimmedUrl, apiKey.trim());

    if (result.error) {
      if (statusEl) statusEl.textContent = t("settings.fetch_failed", { error: result.error });
      modelSelect.innerHTML = `<option value="">${t("settings.failed_models")}</option>`;
      return result;
    }

    if (result.models.length === 0) {
      if (statusEl) statusEl.textContent = t("settings.fetch_no_models");
      modelSelect.innerHTML = `<option value="">${t("settings.no_models")}</option>`;
      return result;
    }

    modelSelect.innerHTML = `<option value="">${t("settings.select_model")}</option>` +
      result.models.map(m => `<option value="${m}">${m}</option>`).join("");

    if (statusEl) statusEl.textContent = t("settings.fetch_success", { count: result.models.length });
    return result;
  }

  // ---- Combat Panel Methods ----

  private renderCombatPanel(): void {
    const combatPanel = document.getElementById("combat-panel");
    if (!combatPanel) return;

    const initiativeOrder = gameState.initiativeOrder || [];
    const currentRound = gameState.currentRound || 1;
    const currentTurnIndex = gameState.currentTurnIndex || 0;
    const currentPlayer = gameState.currentPlayerName;

    if (initiativeOrder.length === 0) {
      combatPanel.innerHTML = `
        <h3>${t("combat.title")}</h3>
        <p class="combat-empty">${t("combat.no_initiative")}</p>
      `;
      return;
    }

    // DM controls (only visible to DM)
    const dmControls = gameState.currentPlayer?.isDM ? `
      <div class="dm-controls">
        <button id="advance-turn-btn" class="secondary">${t("combat.advance_turn")}</button>
        <button id="end-combat-btn" class="danger">${t("combat.end")}</button>
      </div>
    ` : "";

    combatPanel.innerHTML = `
      <h3>${t("combat.title")} - ${t("combat.round", { round: currentRound })}</h3>
      <div class="current-turn-indicator">
        <span class="current-turn-label">${t("combat.current_turn")}: </span>
        <span class="current-turn-name">${this.escapeHtml(currentPlayer || "Unknown")}</span>
      </div>
      <ul class="initiative-list">
        ${initiativeOrder.map((entry, index) => {
          const isCurrentTurn = index === currentTurnIndex;
          const hpPercent = entry.maxHp > 0 ? Math.round((entry.hp / entry.maxHp) * 100) : 0;
          const hpClass = hpPercent > 60 ? 'high' : hpPercent > 30 ? 'mid' : 'low';
          
          return `
            <li class="initiative-entry ${isCurrentTurn ? 'current-turn' : ''}" data-entity-id="${entry.playerId || entry.npcId}">
              <div class="initiative-rank">#${index + 1}</div>
              <div class="initiative-info">
                <span class="initiative-name">${this.escapeHtml(entry.name)}</span>
                ${entry.isPlayer ? `<span class="badge-player">${t("combat.player")}</span>` : `<span class="badge-npc">${t("combat.npc")}</span>`}
              </div>
              <div class="initiative-stats">
                <span class="initiative-score">Init: ${entry.score}</span>
                <span class="initiative-ac">AC: ${entry.ac}</span>
              </div>
              <div class="initiative-hp">
                <div class="hp-bar-mini">
                  <div class="hp-bar-fill-mini ${hpClass}" style="width:${hpPercent}%"></div>
                </div>
                <span class="hp-text">${entry.hp}/${entry.maxHp}</span>
              </div>
            </li>
          `;
        }).join('')}
      </ul>
      ${dmControls}
    `;

    // Attach DM control event handlers
    const advanceBtn = document.getElementById("advance-turn-btn");
    if (advanceBtn) {
      advanceBtn.addEventListener("click", () => {
        wsManager.send("TURN_ADVANCE", {});
      });
    }

    const endCombatBtn = document.getElementById("end-combat-btn");
    if (endCombatBtn) {
      endCombatBtn.addEventListener("click", () => {
        wsManager.send("COMBAT_END", {});
      });
    }
  }

  private setupDMControls(): void {
    const startCombatBtn = document.getElementById("start-combat-btn");
    if (startCombatBtn) {
      startCombatBtn.addEventListener("click", () => {
        wsManager.send("COMBAT_START", { startInitiative: true });
      });
    }
  }

  // ---- DM Control Panel Methods ----

  private renderDMControlPanel(): void {
    // Only render if current player is DM
    if (!gameState.currentPlayer?.isDM) return;

    const panel = document.getElementById("dm-control-panel");
    if (!panel) return;

    const npcs = gameState.npcs || [];
    const players = gameState.players || [];

    panel.innerHTML = `
      <div class="dm-control-section">
        <h4>${t("dm_control.npc_conditions")}</h4>
        <ul class="npc-list">
          ${npcs.map(npc => {
            const hpPercent = npc.maxHp > 0 ? Math.round((npc.hp / npc.maxHp) * 100) : 0;
            return `
              <li class="npc-item" data-npc-id="${npc.id}">
                <div class="npc-header">
                  <span class="npc-name">${this.escapeHtml(npc.name)}</span>
                  <span class="npc-role ${npc.role}">${t(`dm_control.role_${npc.role}`)}</span>
                </div>
                <div class="hp-slider-container">
                  <input type="range" class="hp-slider" min="0" max="${npc.maxHp}" value="${npc.hp}" data-npc-id="${npc.id}">
                  <div class="hp-display">${npc.hp}/${npc.maxHp} (${hpPercent}%)</div>
                </div>
                <div class="conditions-list">
                  ${this.renderConditionCheckboxes(npc)}
                </div>
                <button class="btn-small btn-danger-small" data-action="delete-npc" data-npc-id="${npc.id}">${t("dm_control.btn_delete")}</button>
              </li>
            `;
          }).join('')}
        </ul>
      </div>

      <div class="dm-control-section">
        <h4>${t("dm_control.npc_create")}</h4>
        <form id="create-npc-form">
          <div class="form-group">
            <label>${t("dm_control.npc_name")}</label>
            <input type="text" name="name" required placeholder="Goblin Warrior">
          </div>
          <div class="form-group">
            <label>${t("dm_control.npc_description")}</label>
            <input type="text" name="description" placeholder="A hostile goblin scout">
          </div>
          <div class="form-group">
            <label>${t("dm_control.npc_role")}</label>
            <select name="role">
              <option value="hostile">${t("dm_control.role_hostile")}</option>
              <option value="neutral">${t("dm_control.role_neutral")}</option>
              <option value="friendly">${t("dm_control.role_friendly")}</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>${t("dm_control.npc_hp_label")}</label>
              <input type="number" name="hp" min="0" value="10" required>
            </div>
            <div class="form-group">
              <label>${t("dm_control.npc_max_hp")}</label>
              <input type="number" name="maxHp" min="0" value="10" required>
            </div>
            <div class="form-group">
              <label>${t("dm_control.npc_ac")}</label>
              <input type="number" name="ac" min="0" value="12" required>
            </div>
          </div>
          <button type="submit" class="btn-small">${t("dm_control.btn_create")}</button>
        </form>
      </div>

      <div class="dm-control-section">
        <h4>${t("dm_control.xp_award")}</h4>
        <form id="award-xp-form">
          <div class="form-group">
            <label>${t("dm_control.player_select")}</label>
            <select name="playerId">
              ${players.map(p => `<option value="${p.id}">${this.escapeHtml(p.characterName || p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>${t("dm_control.xp_amount")}</label>
            <input type="number" name="amount" min="0" value="100" required>
          </div>
          <button type="submit" class="btn-small">${t("dm_control.btn_award")}</button>
        </form>
      </div>

      <div class="dm-control-section">
        <h4>${t("dm_control.level_up")}</h4>
        <form id="level-up-form">
          <div class="form-group">
            <label>${t("dm_control.player_select")}</label>
            <select name="playerId">
              ${players.map(p => `<option value="${p.id}">${this.escapeHtml(p.characterName || p.name)} (Lv.${p.level})</option>`).join('')}
            </select>
          </div>
          <button type="submit" class="btn-small">${t("dm_control.btn_level_up")}</button>
        </form>
      </div>
    `;

    // Attach event handlers
    this.attachDMControlHandlers();
  }

  private renderConditionCheckboxes(npc: any): string {
    const conditions = [
      "blinded", "charmed", "deafened", "frightened", "grappled",
      "incapacitated", "invisible", "paralyzed", "petrified", "poisoned",
      "prone", "restrained", "stunned", "unconscious"
    ];

    return conditions.map(cond => {
      const isChecked = npc.conditions?.includes(cond) ? "checked" : "";
      return `
        <label class="condition-checkbox">
          <input type="checkbox" ${isChecked} data-npc-id="${npc.id}" data-condition="${cond}">
          ${t(`dm_control.condition_${cond}`)}
        </label>
      `;
    }).join('');
  }

  private attachDMControlHandlers(): void {
    const panel = document.getElementById("dm-control-panel");
    if (!panel) return;

    // HP slider changes
    panel.querySelectorAll(".hp-slider").forEach(slider => {
      slider.addEventListener("input", (e) => {
        const target = e.target as HTMLInputElement;
        const npcId = target.dataset.npcId;
        const newHp = parseInt(target.value);
        
        // Update display
        const hpDisplay = target.parentElement?.querySelector(".hp-display");
        if (hpDisplay) {
          const maxHp = parseInt(target.max);
          const percent = Math.round((newHp / maxHp) * 100);
          hpDisplay.textContent = `${newHp}/${maxHp} (${percent}%)`;
        }

        // Send to server
        wsManager.send("NPC_UPDATE_HP", { npcId, newHp });
      });
    });

    // Condition checkboxes
    panel.querySelectorAll(".condition-checkbox input").forEach(checkbox => {
      checkbox.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const npcId = target.dataset.npcId;
        const condition = target.dataset.condition;
        
        if (target.checked) {
          wsManager.send("NPC_APPLY_CONDITION", { npcId, condition });
        } else {
          wsManager.send("NPC_REMOVE_CONDITION", { npcId, condition });
        }
      });
    });

    // Delete NPC buttons
    panel.querySelectorAll("[data-action='delete-npc']").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const npcId = target.dataset.npcId;
        const npcName = target.closest(".npc-item")?.querySelector(".npc-name")?.textContent || "NPC";
        
        if (confirm(`Delete ${npcName}?`)) {
          wsManager.send("NPC_DELETE", { npcId });
        }
      });
    });

    // Create NPC form
    const createForm = document.getElementById("create-npc-form");
    if (createForm) {
      createForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        
        wsManager.send("NPC_CREATE", {
          name: formData.get("name") as string,
          description: formData.get("description") as string || "",
          role: formData.get("role") as "friendly" | "neutral" | "hostile",
        });

        // Note: Full stats NPC creation will be added as a separate endpoint
        form.reset();
      });
    }

    // Award XP form
    const awardForm = document.getElementById("award-xp-form");
    if (awardForm) {
      awardForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        
        wsManager.send("PLAYER_AWARD_XP", {
          playerId: formData.get("playerId") as string,
          amount: parseInt(formData.get("amount") as string),
        });

        form.reset();
      });
    }

    // Level Up form
    const levelForm = document.getElementById("level-up-form");
    if (levelForm) {
      levelForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        
        wsManager.send("PLAYER_LEVEL_UP", {
          playerId: formData.get("playerId") as string,
        });

        form.reset();
      });
    }
  }

  private setupDMControlPanelToggle(): void {
    // Create toggle button if not exists
    let toggleBtn = document.getElementById("dm-control-toggle");
    if (!toggleBtn) {
      toggleBtn = document.createElement("button");
      toggleBtn.id = "dm-control-toggle";
      toggleBtn.className = "dm-control-panel-toggle";
      toggleBtn.textContent = "🎛️";
      toggleBtn.style.display = "none"; // Hide by default
      document.body.appendChild(toggleBtn);
    }

    // Show toggle button only for DM
    if (gameState.currentPlayer?.isDM) {
      toggleBtn.style.display = "flex";
    } else {
      toggleBtn.style.display = "none";
      document.getElementById("dm-control-panel")?.remove();
    }

    // Toggle panel visibility
    toggleBtn.addEventListener("click", () => {
      const panel = document.getElementById("dm-control-panel");
      if (panel) {
        panel.remove();
      } else {
        this.renderDMControlPanel();
      }
    });

    // Listen for DM_CONTROL_UPDATE to refresh panel
    wsManager.addMessageHandler("DM_CONTROL_UPDATE", () => {
      const panel = document.getElementById("dm-control-panel");
      if (panel) {
        this.renderDMControlPanel();
      }
    });
  }

  // ---- Inventory Panel Methods ----

  private renderInventoryPanel(): void {
    const player = gameState.currentPlayer;
    if (!player) return;

    let inventoryPanel = document.getElementById("inventory-panel");
    if (!inventoryPanel) {
      inventoryPanel = document.createElement("aside");
      inventoryPanel.id = "inventory-panel";
      inventoryPanel.className = "combat-panel hidden"; // Reuse combat panel styles
      const mainContent = document.querySelector(".main-content");
      if (mainContent) {
        mainContent.insertAdjacentElement("afterend", inventoryPanel);
      }
    }

    inventoryPanel.innerHTML = `
      <h3>${t("inventory.title")}</h3>
      ${player.inventory?.length ? `
        <ul class="inventory-list">
          ${player.inventory.map(item => `
            <li class="inventory-item" data-item-id="${item.id}">
              <div class="item-header">
                <span class="item-name">${this.escapeHtml(item.name)}</span>
                <span class="item-type">${t(`item.type_${item.type}`)}</span>
              </div>
              ${item.description ? `<div class="item-desc">${this.escapeHtml(item.description)}</div>` : ''}
              <div class="item-stats">
                ${item.stats?.attackBonus ? `<span>Attack: +${item.stats.attackBonus}</span>` : ''}
                ${item.stats?.armorClassBonus ? `<span>AC: +${item.stats.armorClassBonus}</span>` : ''}
                ${item.stats?.healingAmount ? `<span>Heal: ${item.stats.healingAmount} HP</span>` : ''}
              </div>
              <div class="item-actions">
                ${item.type === "weapon" ? `
                  <button class="btn-small ${player.equippedWeapon?.id === item.id ? 'btn-active' : ''}" data-action="equip-weapon" data-item-id="${item.id}">${player.equippedWeapon?.id === item.id ? t("inventory.unequip_btn") : t("inventory.equip_btn")}</button>
                ` : ''}
                ${item.type === "armor" ? `
                  <button class="btn-small ${player.equippedArmor?.id === item.id ? 'btn-active' : ''}" data-action="equip-armor" data-item-id="${item.id}">${player.equippedArmor?.id === item.id ? t("inventory.unequip_btn") : t("inventory.equip_btn")}</button>
                ` : ''}
                ${item.type === "consumable" ? `
                  <button class="btn-small btn-use" data-action="use-item" data-item-id="${item.id}">${t("inventory.use_btn")}</button>
                ` : ''}
              </div>
            </li>
          `).join('')}
        </ul>
        <div class="inventory-weight">${t("inventory.weight", { weight: player.inventory.reduce((sum, i) => sum + i.weight, 0) })}</div>
      ` : `<p class="combat-empty">${t("inventory.empty")}</p>`}
    `;

    // Attach event handlers
    inventoryPanel.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const action = target.getAttribute("data-action");
        const itemId = target.getAttribute("data-item-id");
        
        if (action === "equip-weapon" && itemId) {
          wsManager.send("EQUIP_WEAPON", { itemId });
        } else if (action === "equip-armor" && itemId) {
          wsManager.send("EQUIP_ARMOR", { itemId });
        } else if (action === "use-item" && itemId) {
          wsManager.send("USE_ITEM", { itemId });
        }
      });
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  (window as unknown as { app: App }).app = new App();
});
