import { gameState } from "../game-state.js";
import { t, getLocalizedRaceName, getLocalizedClassName } from "../i18n.js";
import { escapeHtml } from "../utils.js";
import { icon } from "../icons.js";
import { XP_THRESHOLDS } from "../../../shared/schemas/game.js";
import type { Player } from "../../../shared/index.js";

const MAX_LEVEL = 20;
const HP_HIGH_THRESHOLD = 0.6;
const HP_MID_THRESHOLD = 0.3;

/** Bucket a HP ratio into the three bar colours defined in the stylesheet. */
function hpClass(hp: number, maxHp: number): "high" | "mid" | "low" {
  if (hp > maxHp * HP_HIGH_THRESHOLD) return "high";
  if (hp > maxHp * HP_MID_THRESHOLD) return "mid";
  return "low";
}

/** XP needed for the next level; level 20 characters sit at the final threshold. */
function nextLevelXP(level: number): number {
  return XP_THRESHOLDS[level + 1] || XP_THRESHOLDS[MAX_LEVEL];
}

/**
 * The party roster: a fixed DM card followed by one card per player with HP
 * and XP bars.
 *
 * `updateHP` patches the bars in place rather than re-rendering, so frequent
 * HP changes don't blow away the list or interrupt scrolling.
 */
export class PlayersPanelView {
  /** Full markup for the panel, embedded by the app when it builds the game UI. */
  render(scenarioLabel: string): string {
    const game = gameState.game;
    if (!game) return "";

    const players = game.players || [];
    const dmStatusText = t("dm_status.active", { count: players.length });

    return `
      <h3>${t("players.title")} (${players.length}/${game.maxPlayers})</h3>
      <ul id="players-list">
        <li class="dm-card">
          <span class="badge-dm">${t("dm.name")}</span>
          <div class="player-info">
            <span class="character-name" style="color:var(--accent-gold)">${t("dm.storyteller_name")}</span>
            <span class="player-detail">${escapeHtml(scenarioLabel)}</span>
          </div>
          <div class="dm-status">
            <span class="status-dot"></span> ${dmStatusText}
          </div>
        </li>
        ${players.map(p => this.renderPlayerCard(p)).join("")}
      </ul>
    `;
  }

  private renderPlayerCard(player: Player): string {
    const isCurrent = gameState.currentPlayer?.id === player.id;
    const requiredXP = nextLevelXP(player.level);
    const xpProgress = player.level < MAX_LEVEL ? Math.round((player.xp / requiredXP) * 100) : 100;
    const hasHP = player.hp !== undefined && player.maxHp > 0;

    return `
      <li class="player-status ${isCurrent ? "current-player" : ""}" data-player-id="${escapeHtml(player.id)}">
        <div class="player-info">
          <span class="character-name">${escapeHtml(player.characterName)}</span>
          <span class="player-detail">${escapeHtml(getLocalizedRaceName(player.race))} ${escapeHtml(getLocalizedClassName(player.characterClass))} ${t("level.abbreviation")}${player.level}</span>
        </div>
        ${hasHP ? `
          <div class="hp-bar-container">
            <div class="hp-bar-track">
              <div class="hp-bar-fill ${hpClass(player.hp, player.maxHp)}" style="width:${Math.round((player.hp / player.maxHp) * 100)}%"></div>
              <span class="hp-bar-text">${icon("heart")} ${player.hp}/${player.maxHp}</span>
            </div>
          </div>
        ` : ""}
        <div class="xp-bar">
          <span class="xp-text">XP: ${player.xp} / ${requiredXP}</span>
          ${player.level < MAX_LEVEL
            ? `<span class="xp-progress">${xpProgress}%</span>`
            : `<span class="max-level">${t("level.max")}</span>`}
        </div>
      </li>
    `;
  }

  /** Patch the HP bars in place from current state. */
  updateHP(): void {
    const list = document.getElementById("players-list");
    const game = gameState.game;
    if (!list || !game) return;

    list.querySelectorAll("li.player-status").forEach(item => {
      const player = game.players.find(p => p.id === item.getAttribute("data-player-id"));
      if (player?.hp === undefined || player.maxHp <= 0) return;

      const fill = item.querySelector<HTMLElement>(".hp-bar-fill");
      if (fill) {
        fill.style.width = `${Math.round((player.hp / player.maxHp) * 100)}%`;
        fill.classList.remove("high", "mid", "low");
        fill.classList.add(hpClass(player.hp, player.maxHp));
      }

      const text = item.querySelector<HTMLElement>(".hp-bar-text");
      if (text) text.innerHTML = `${icon("heart")} ${player.hp}/${player.maxHp}`;
    });
  }
}
