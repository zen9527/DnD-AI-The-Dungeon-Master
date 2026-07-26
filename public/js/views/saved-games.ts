import { t } from "../i18n.js";
import { escapeHtml, showNotification } from "../utils.js";

export interface SavedGame {
  id: string;
  name: string;
  createdAt: number;
}

/**
 * The list of games on disk, shown under the character creator.
 *
 * Loading a save needs a character to load *as*, so this view only reports the
 * chosen game id; the creator owns the form that follows.
 */
export class SavedGamesView {
  constructor(private readonly onLoad: (gameId: string) => void) {}

  private get container(): HTMLElement | null {
    return document.getElementById("saved-games-container");
  }

  /** Fetch and render. Silently does nothing if the API isn't up yet. */
  async refresh(): Promise<void> {
    try {
      const response = await fetch("/api/saved-games");
      if (!response.ok) return;
      this.render(await response.json());
    } catch {
      // The lobby is still usable without the saved-games list.
    }
  }

  render(games: SavedGame[]): void {
    const container = this.container;
    if (!container) return;

    this.setSectionVisible(true);

    if (games.length === 0) {
      container.innerHTML = `<p class="no-games">${t("saved_games.empty")}</p>`;
      return;
    }

    container.innerHTML = games.map(game => this.renderCard(game)).join("");
    this.bindEvents(container);
  }

  private renderCard(game: SavedGame): string {
    const date = new Date(game.createdAt).toLocaleDateString();
    return `
      <div class="game-card saved-game" data-saved-id="${escapeHtml(game.id)}">
        <div class="game-card-header">
          <span class="scenario-badge">💾</span>
          <h3>${escapeHtml(game.name)}</h3>
          <button class="delete-saved-btn" data-saved-id="${escapeHtml(game.id)}" title="${t("saved_games.delete_btn")}">🗑️</button>
        </div>
        <div class="game-card-body">
          <span class="game-scenario-label">${t("saved_games.date_format", { date })}</span>
          <button class="join-game-btn load-saved-btn" data-saved-id="${escapeHtml(game.id)}">
            ${t("saved_games.load_btn")}
          </button>
        </div>
      </div>
    `;
  }

  private bindEvents(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>(".load-saved-btn").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        const gameId = button.dataset.savedId;
        if (gameId) this.onLoad(gameId);
      });
    });

    container.querySelectorAll<HTMLElement>(".delete-saved-btn").forEach(button => {
      button.addEventListener("click", async event => {
        event.stopPropagation();
        const gameId = button.dataset.savedId;
        if (!gameId) return;

        const card = button.closest<HTMLElement>(".game-card");
        const name = card?.querySelector("h3")?.textContent || "";
        if (!confirm(t("saved_games.confirm_delete", { name }))) return;

        await this.deleteGame(gameId, card, container);
      });
    });
  }

  private async deleteGame(gameId: string, card: HTMLElement | null, container: HTMLElement): Promise<void> {
    try {
      const response = await fetch(`/api/saved-games/${gameId}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        showNotification(data.error || t("saved_games.delete_error"), "error");
        return;
      }

      card?.remove();
      showNotification(t("saved_games.deleted"), "success");

      // Removing the last card should leave the empty state, not a blank panel.
      if (container.querySelectorAll(".game-card").length === 0) {
        container.innerHTML = `<p class="no-games">${t("saved_games.empty")}</p>`;
        this.setSectionVisible(false);
      }
    } catch (error) {
      showNotification(t("saved_games.delete_error"), "error");
      console.error("Delete failed:", error);
    }
  }

  private setSectionVisible(visible: boolean): void {
    const section = document.getElementById("saved-games-section");
    if (section) section.style.display = visible ? "block" : "none";
  }
}
