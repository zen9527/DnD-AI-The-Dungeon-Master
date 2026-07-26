import { wsManager } from "../websocket.js";
import { gameState } from "../game-state.js";
import { t, tKey, toSupportedLocale, getLocale, setLocale, getLocalizedScenarios, SUPPORTED_LOCALES } from "../i18n.js";
import { escapeHtml, renderLocaleDropdownHTML, getLocaleDisplayName } from "../utils.js";
import { raceOptions, classOptions } from "../../../shared/schemas/game.js";

const ATTRIBUTES = ["str", "dex", "con", "int", "wis", "cha"] as const;
const DEFAULT_ATTRIBUTE_VALUE = 10;

/** The pre-game screens: the list of joinable games and the join form. */
export class LobbyView {
  /** Render the "active games" grid, or an empty state. */
  renderActiveGames(
    games: Array<{ id: string; name: string; scenario: string; players: number; maxPlayers: number }>
  ): void {
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

    const scenarios = getLocalizedScenarios();

    container.innerHTML = games.map(game => {
      const scenario = scenarios[game.scenario] || scenarios.dungeon;
      const isFull = game.players >= game.maxPlayers;
      const statusText = isFull
        ? t("active_games.full")
        : t("active_games.players", { current: game.players, max: game.maxPlayers });

      return `
        <div class="game-card ${isFull ? "full" : ""}" data-game-id="${escapeHtml(game.id)}">
          <div class="game-card-header">
            <span class="scenario-badge">${scenario.icon}</span>
            <h3>${escapeHtml(game.name)}</h3>
            <span class="status-badge ${isFull ? "status-full" : "status-open"}">${statusText}</span>
          </div>
          <div class="game-card-body">
            <span class="game-scenario-label">${scenario.label}</span>
            <button class="join-game-btn ${isFull ? "disabled" : ""}" data-game-id="${escapeHtml(game.id)}" ${isFull ? "disabled" : ""}>
              ${isFull ? t("active_games.full") : t("active_games.join")}
            </button>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".game-card[data-game-id], .join-game-btn:not(.disabled)").forEach(el => {
      el.addEventListener("click", event => {
        event.stopPropagation();
        const gameId = el.getAttribute("data-game-id");
        if (gameId && !el.classList.contains("disabled")) {
          window.location.href = `?game=${gameId}`;
        }
      });
    });
  }

  /**
   * Render the character form shown when arriving at a game link.
   * `onSettings` opens the LLM settings dialog from the gear icon.
   */
  showJoinForm(gameId: string, onSettings: () => void): void {
    const app = document.getElementById("app");
    if (!app) return;

    const races = raceOptions.map(r => `<option value="${r}">${tKey(`race.${r.toLowerCase()}`)}</option>`).join("");
    const classes = classOptions.map(c => `<option value="${c}">${tKey(`class.${c.toLowerCase()}`)}</option>`).join("");

    app.innerHTML = `
      <div class="welcome-screen">
        ${renderLocaleDropdownHTML(SUPPORTED_LOCALES, getLocale(), getLocaleDisplayName)}
        <div class="settings-trigger" title="${t("settings.title")}">⚙️</div>
        <h2>${t("join_game_page.title")}</h2>
        <form id="join-form">
          <label>${t("player_name.label")} <input type="text" id="player-name" required></label>
          <label>${t("character_name.label")} <input type="text" id="character-name" required></label>
          <label>${t("race.label")} <select id="race">${races}</select></label>
          <label>${t("class.label")} <select id="character-class">${classes}</select></label>
          <h3>${t("attributes.title")}</h3>
          <div class="attributes-grid">
            ${ATTRIBUTES.map(attr => `
              <label>${t(`attributes.${attr}`)}
                <input type="number" id="attr-${attr}" min="3" max="18" value="${DEFAULT_ATTRIBUTE_VALUE}">
              </label>
            `).join("")}
          </div>
          <button type="submit" class="primary">${t("join_form.btn")}</button>
        </form>
      </div>
    `;

    app.querySelector(".settings-trigger")?.addEventListener("click", onSettings);

    document.getElementById("locale-select")?.addEventListener("change", event => {
      setLocale(toSupportedLocale((event.target as HTMLSelectElement).value));
      location.reload();
    });

    document.getElementById("join-form")?.addEventListener("submit", event => {
      event.preventDefault();
      // Auto-join may have already succeeded while the form was on screen.
      if (gameState.currentPlayer) return;

      wsManager.send({
        type: "JOIN_GAME",
        payload: {
          gameId,
          playerName: (document.getElementById("player-name") as HTMLInputElement).value.trim(),
          characterName: (document.getElementById("character-name") as HTMLInputElement).value.trim(),
          race: (document.getElementById("race") as HTMLSelectElement).value,
          characterClass: (document.getElementById("character-class") as HTMLSelectElement).value,
          attributes: Object.fromEntries(
            ATTRIBUTES.map(attr => [attr, parseInt((document.getElementById(`attr-${attr}`) as HTMLInputElement).value)])
          ),
          locale: getLocale(),
        },
      });
    });
  }
}
