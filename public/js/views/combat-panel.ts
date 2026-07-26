import { wsManager } from "../websocket.js";
import { gameState } from "../game-state.js";
import { t } from "../i18n.js";
import { escapeHtml } from "../utils.js";
import type { InitiativeEntry } from "../../../shared/index.js";

const HP_HIGH_PERCENT = 60;
const HP_MID_PERCENT = 30;

/**
 * The initiative tracker shown during combat: turn order, whose turn it is,
 * and — for the DM — controls to advance the turn or end the fight.
 */
export class CombatPanelView {
  private get panel(): HTMLElement | null {
    return document.getElementById("combat-panel");
  }

  show(): void {
    this.panel?.classList.remove("hidden");
  }

  hide(): void {
    this.panel?.classList.add("hidden");
  }

  render(): void {
    const panel = this.panel;
    if (!panel) return;

    const initiativeOrder = gameState.initiativeOrder || [];

    if (initiativeOrder.length === 0) {
      panel.innerHTML = `
        <h3>${t("combat.title")}</h3>
        <p class="combat-empty">${t("combat.no_initiative")}</p>
      `;
      return;
    }

    const currentTurnIndex = gameState.currentTurnIndex || 0;
    const dmControls = gameState.currentPlayer?.isDM
      ? `
        <div class="dm-controls">
          <button id="advance-turn-btn" class="secondary">${t("combat.advance_turn")}</button>
          <button id="end-combat-btn" class="danger">${t("combat.end")}</button>
        </div>
      `
      : "";

    panel.innerHTML = `
      <h3>${t("combat.title")} - ${t("combat.round", { round: gameState.currentRound || 1 })}</h3>
      <div class="current-turn-indicator">
        <span class="current-turn-label">${t("combat.current_turn")}: </span>
        <span class="current-turn-name">${escapeHtml(gameState.currentPlayerName || t("player.unknown"))}</span>
      </div>
      <ul class="initiative-list">
        ${initiativeOrder.map((entry, index) => this.renderEntry(entry, index, index === currentTurnIndex)).join("")}
      </ul>
      ${dmControls}
    `;

    this.bindEvents();
  }

  private renderEntry(entry: InitiativeEntry, index: number, isCurrentTurn: boolean): string {
    const hpPercent = entry.maxHp > 0 ? Math.round((entry.hp / entry.maxHp) * 100) : 0;
    const hpClass = hpPercent > HP_HIGH_PERCENT ? "high" : hpPercent > HP_MID_PERCENT ? "mid" : "low";

    return `
      <li class="initiative-entry ${isCurrentTurn ? "current-turn" : ""}" data-entity-id="${escapeHtml(entry.playerId || entry.npcId || "")}">
        <div class="initiative-rank">#${index + 1}</div>
        <div class="initiative-info">
          <span class="initiative-name">${escapeHtml(entry.name)}</span>
          <span class="${entry.isPlayer ? "badge-player" : "badge-npc"}">${t(entry.isPlayer ? "combat.player" : "combat.npc")}</span>
        </div>
        <div class="initiative-stats">
          <span class="initiative-score">${t("combat.initiative_short")}: ${entry.score}</span>
          <span class="initiative-ac">${t("combat.ac_short")}: ${entry.ac}</span>
        </div>
        <div class="initiative-hp">
          <div class="hp-bar-mini">
            <div class="hp-bar-fill-mini ${hpClass}" style="width:${hpPercent}%"></div>
          </div>
          <span class="hp-text">${entry.hp}/${entry.maxHp}</span>
        </div>
      </li>
    `;
  }

  private bindEvents(): void {
    document.getElementById("advance-turn-btn")?.addEventListener("click", () => {
      wsManager.send({ type: "TURN_ADVANCE", payload: {} });
    });

    document.getElementById("end-combat-btn")?.addEventListener("click", () => {
      wsManager.send({ type: "COMBAT_END", payload: {} });
    });
  }
}
