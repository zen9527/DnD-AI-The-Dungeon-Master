import { wsManager } from "./websocket.js";
import { raceOptions, classOptions, scenarioOptions, scenarioDescriptions } from "../../shared/schemas/game.js";

export class CharacterCreator {
  private element: HTMLElement | null = null;
  private selectedScenario: string = "dungeon";

  constructor() {
    this.element = document.getElementById("app");
    if (!this.element) return;
    this.showForm();
  }

  private showForm(): void {
    this.element!.innerHTML = `
      <div class="welcome-screen">
        <div class="settings-trigger" title="LLM Settings">⚙️</div>
        <h1>DnD Full Auto-DM</h1>
        <p class="subtitle">The AI Dungeon Master awaits your adventure</p>

        <div class="options">
          <button id="create-game-btn" class="primary">Create New Game</button>
          <div class="divider">OR</div>
          <div class="join-form">
            <input type="text" id="game-id-input" placeholder="Enter Game ID">
            <button id="join-game-btn">Join Game</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("create-game-btn")?.addEventListener("click", () => this.showScenarioSelection());
    document.getElementById("join-game-btn")?.addEventListener("click", () => {
      const gameId = (document.getElementById("game-id-input") as HTMLInputElement).value.trim();
      if (gameId) window.location.href = `?game=${gameId}`;
    });
    document.querySelector(".settings-trigger")?.addEventListener("click", () => {
      (window as unknown as { app: { showSettingsModal: () => void } }).app?.showSettingsModal();
    });
  }

  private showScenarioSelection(): void {
    const cards = scenarioOptions.map(s => {
      const desc = scenarioDescriptions[s as keyof typeof scenarioDescriptions];
      return `
        <div class="scenario-card" data-scenario="${s}">
          <div class="scenario-icon">${desc.icon}</div>
          <div class="scenario-label">${desc.label}</div>
          <div class="scenario-desc">${desc.description}</div>
        </div>
      `;
    }).join("");

    this.element!.innerHTML = `
      <div class="welcome-screen">
        <h2>Choose Your Adventure</h2>
        <p class="subtitle">Select a scenario for the Dungeon Master</p>
        <div class="scenario-grid">${cards}</div>
        <div class="form-actions">
          <button type="button" id="cancel-btn">Back</button>
        </div>
      </div>
    `;

    document.getElementById("cancel-btn")?.addEventListener("click", () => this.showForm());

    this.element!.querySelectorAll(".scenario-card").forEach(card => {
      card.addEventListener("click", () => {
        this.element!.querySelectorAll(".scenario-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        this.selectedScenario = card.getAttribute("data-scenario") || "dungeon";
        setTimeout(() => this.showCreateForm(), 300);
      });
    });
  }

  private showCreateForm(): void {
    const races = raceOptions.map(r => `<option value="${r}">${r}</option>`).join("");
    const classes = classOptions.map(c => `<option value="${c}">${c}</option>`).join("");

    this.element!.innerHTML = `
      <div class="welcome-screen">
        <h2>Create New Game</h2>
        <p class="subtitle">Scenario: ${scenarioDescriptions[this.selectedScenario as keyof typeof scenarioDescriptions].icon} ${scenarioDescriptions[this.selectedScenario as keyof typeof scenarioDescriptions].label}</p>
        <form id="create-game-form">
          <label>Game Name
            <input type="text" id="game-name" placeholder="The Lost Temple" required>
          </label>
          <label>Max Players
            <select id="max-players">
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4" selected>4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
            </select>
          </label>
          <hr>
          <h3>Your Character</h3>
          <label>Race
            <select id="race">${races}</select>
          </label>
          <label>Class
            <select id="character-class">${classes}</select>
          </label>
          <label>Player Name
            <input type="text" id="player-name" placeholder="Your name" required>
          </label>
          <label>Character Name
            <input type="text" id="character-name" placeholder="Character name" required>
          </label>
          <h3>Attributes (3-18 each)</h3>
          <div class="attributes-grid">
            <label>STR <input type="number" id="attr-str" min="3" max="18" value="10"></label>
            <label>DEX <input type="number" id="attr-dex" min="3" max="18" value="10"></label>
            <label>CON <input type="number" id="attr-con" min="3" max="18" value="10"></label>
            <label>INT <input type="number" id="attr-int" min="3" max="18" value="10"></label>
            <label>WIS <input type="number" id="attr-wis" min="3" max="18" value="10"></label>
            <label>CHA <input type="number" id="attr-cha" min="3" max="18" value="10"></label>
          </div>
          <div class="form-actions">
            <button type="submit" class="primary">Create Game</button>
            <button type="button" id="back-btn">Back</button>
          </div>
        </form>
      </div>
    `;

    document.getElementById("back-btn")?.addEventListener("click", () => this.showScenarioSelection());
    document.getElementById("create-game-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.createGame();
    });
  }

  private createGame(): void {
    const payload = {
      gameName: (document.getElementById("game-name") as HTMLInputElement).value.trim(),
      maxPlayers: parseInt((document.getElementById("max-players") as HTMLSelectElement).value),
      scenario: this.selectedScenario,
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
    };

    wsManager.send({ type: "CREATE_GAME", payload });
  }

  private escapeHtml(text: string): string {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
