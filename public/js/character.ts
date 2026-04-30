import { wsManager } from "./websocket.js";
import { raceOptions, classOptions, scenarioOptions, scenarioDescriptions } from "../../shared/schemas/game.js";

interface Attributes { str: number; dex: number; con: number; int: number; wis: number; cha: number };

// Default values for auto-generation (matches src/utils/defaults.ts)
const CLASS_ATTRIBUTE_BONUSES: Record<string, Partial<Attributes>> = {
  "Barbarian": { str: 16, con: 14 },
  "Fighter": { str: 15, con: 13 },
  "Paladin": { str: 15, cha: 13, con: 12 },
  "Rogue": { dex: 16, int: 12 },
  "Ranger": { dex: 14, wis: 13, str: 12 },
  "Wizard": { int: 17, wis: 12 },
  "Artificer": { int: 15, con: 12 },
  "Cleric": { wis: 16, cha: 12, con: 13 },
  "Druid": { wis: 15, int: 12, con: 13 },
  "Monk": { dex: 14, wis: 14, str: 10 },
  "Bard": { cha: 16, dex: 12, int: 12 },
  "Sorcerer": { cha: 15, con: 12 },
  "Warlock": { cha: 15, wis: 12 },
};

const RACE_ATTRIBUTE_BONUSES: Record<string, Partial<Attributes>> = {
  "Human": { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
  "Elf": { dex: 2 },
  "Dwarf": { con: 2 },
  "Halfling": { dex: 2, luck: 1 } as Partial<Attributes>,
  "Dragonborn": { str: 2, cha: 2 },
  "Half-Elf": { cha: 2, dex: 1, wis: 1 } as Partial<Attributes>,
  "Gnome": { int: 2 },
  "Half-Orc": { str: 2, con: 2 },
};

const CLASS_NAME_PREFIXES: Record<string, string> = {
  "Barbarian": "Thor", "Fighter": "Garret", "Paladin": "Aldric",
  "Rogue": "Kael", "Ranger": "Sylvan", "Wizard": "Elara",
  "Cleric": "Theron", "Druid": "Rowan", "Monk": "Jian",
  "Bard": "Lyra", "Sorcerer": "Ignis", "Warlock": "Vesper"
};

function generateDefaultAttributes(characterClass: string, race: string): Attributes {
  const classBonuses = CLASS_ATTRIBUTE_BONUSES[characterClass] || {};
  const raceBonuses = RACE_ATTRIBUTE_BONUSES[race] || {};
  
  let attrs: Attributes = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  
  if (classBonuses.str) attrs.str += classBonuses.str;
  if (classBonuses.dex) attrs.dex += classBonuses.dex;
  if (classBonuses.con) attrs.con += classBonuses.con;
  if (classBonuses.int) attrs.int += classBonuses.int;
  if (classBonuses.wis) attrs.wis += classBonuses.wis;
  if (classBonuses.cha) attrs.cha += classBonuses.cha;
  
  if (raceBonuses.str) attrs.str += raceBonuses.str;
  if (raceBonuses.dex) attrs.dex += raceBonuses.dex;
  if (raceBonuses.con) attrs.con += raceBonuses.con;
  if (raceBonuses.int) attrs.int += raceBonuses.int;
  if (raceBonuses.wis) attrs.wis += raceBonuses.wis;
  if (raceBonuses.cha) attrs.cha += raceBonuses.cha;
  
  return {
    str: Math.max(3, Math.min(18, attrs.str)),
    dex: Math.max(3, Math.min(18, attrs.dex)),
    con: Math.max(3, Math.min(18, attrs.con)),
    int: Math.max(3, Math.min(18, attrs.int)),
    wis: Math.max(3, Math.min(18, attrs.wis)),
    cha: Math.max(3, Math.min(18, attrs.cha)),
  };
}

function generateDefaultCharacterName(characterClass: string, race: string): string {
  const prefix = CLASS_NAME_PREFIXES[characterClass] || "Adventurer";
  let suffix = "";
  if (race.toLowerCase().includes("elf")) suffix = "-star";
  else if (race.toLowerCase().includes("dwarf")) suffix = "-stone";
  
  return `${prefix}${suffix}`;
}

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
        <p class="subtitle">Scenario: ${scenarioDescriptions[this.selectedScenario as keyof typeof scenarioDescriptions].icon} ${scenarioDescriptions[this.selectedScenario as keyof typeof scenarioDefinitions].label}</p>
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
          <div class="form-row">
            <label>Race
              <select id="race">${races}</select>
            </label>
            <label>Class
              <select id="character-class">${classes}</select>
            </label>
          </div>
          <button type="button" id="auto-fill-btn" class="secondary">Auto-Generate Attributes & Name</button>
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
    
    // Auto-fill on class/race change
    const raceSelect = document.getElementById("race") as HTMLSelectElement;
    const classSelect = document.getElementById("character-class") as HTMLSelectElement;
    const autoFillBtn = document.getElementById("auto-fill-btn") as HTMLButtonElement;
    
    raceSelect.addEventListener("change", () => this.autoFillAttributesAndName());
    classSelect.addEventListener("change", () => this.autoFillAttributesAndName());
    autoFillBtn?.addEventListener("click", () => this.autoFillAttributesAndName());
    
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

  private autoFillAttributesAndName(): void {
    const raceSelect = document.getElementById("race") as HTMLSelectElement;
    const classSelect = document.getElementById("character-class") as HTMLSelectElement;
    const characterNameInput = document.getElementById("character-name") as HTMLInputElement;
    
    const race = raceSelect.value;
    const characterClass = classSelect.value;
    
    // Auto-generate character name
    const generatedName = generateDefaultCharacterName(characterClass, race);
    if (characterNameInput && !characterNameInput.value) {
      characterNameInput.value = generatedName;
    }
    
    // Auto-generate attributes
    const attrs = generateDefaultAttributes(characterClass, race);
    
    const strInput = document.getElementById("attr-str") as HTMLInputElement;
    const dexInput = document.getElementById("attr-dex") as HTMLInputElement;
    const conInput = document.getElementById("attr-con") as HTMLInputElement;
    const intInput = document.getElementById("attr-int") as HTMLInputElement;
    const wisInput = document.getElementById("attr-wis") as HTMLInputElement;
    const chaInput = document.getElementById("attr-cha") as HTMLInputElement;
    
    if (strInput) strInput.value = attrs.str.toString();
    if (dexInput) dexInput.value = attrs.dex.toString();
    if (conInput) conInput.value = attrs.con.toString();
    if (intInput) intInput.value = attrs.int.toString();
    if (wisInput) wisInput.value = attrs.wis.toString();
    if (chaInput) chaInput.value = attrs.cha.toString();
    
    // Visual feedback
    const formRow = document.querySelector(".form-row");
    if (formRow) {
      formRow.classList.add("auto-filled");
      setTimeout(() => formRow.classList.remove("auto-filled"), 1000);
    }
  }

  private escapeHtml(text: string): string {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
