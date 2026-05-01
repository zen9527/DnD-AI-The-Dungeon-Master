import { wsManager } from "./websocket.js";
import { getLocale, setLocale, t, SUPPORTED_LOCALES } from "./i18n.js";
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

// Fantasy name components for generating unique character names per class+race combination
const NAME_DATA: Record<string, { firstNames: string[]; lastParts: string[] }> = {
  "Human": {
    firstNames: ["Aldric", "Bram", "Cedric", "Dorian", "Elias", "Finn", "Gareth", "Hugo", "Isolde", "Jasper", "Kael", "Liam", "Mira", "Nora", "Orion", "Petra", "Quinn", "Rowan", "Sage", "Talia"],
    lastParts: ["Ashford", "Brightwater", "Carroway", "Dunmore", "Everett", "Fairwind", "Greystone", "Holloway", "Ironheart", "Jasperfield", "Kingsley", "Lightfoot", "Morrowind", "Nighthawk", "Oakenshield", "Proudfoot", "Quicksilver", "Ravencrest", "Stormborn", "Thornwall"]
  },
  "Elf": {
    firstNames: ["Aelindra", "Baelor", "Caelith", "Daelen", "Elandra", "Faelarion", "Galadriel", "Haelwen", "Ilyndra", "Jarethil", "Kaelthas", "Lirael", "Maevea", "Nimrodel", "Orithiel", "Paelora", "Quel'thalas", "Raeliana", "Sylvaris", "Thalandor"],
    lastParts: ["Starweaver", "Moonwhisper", "Dawnstrider", "Shadowleaf", "Silverbough", "Nightbloom", "Sunfire", "Windrunner", "Stormsong", "Mistwalker", "Brightwood", "Emberglade", "Frostveil", "Thornshade", "Riverdance", "Starfall", "Duskwalker", "Moonshadow", "Sunwhisper", "Leafdancer"]
  },
  "Dwarf": {
    firstNames: ["Borin", "Durgan", "Grimnar", "Haldur", "Korgan", "Magni", "Narvi", "Orin", "Thrain", "Ulfar", "Vidar", "Ymir", "Zug", "Brunhild", "Eirlys", "Freya", "Gerd", "Helga", "Ingrid", "Sigrid"],
    lastParts: ["Ironforge", "Stonebeard", "Deepdelver", "Firebrand", "Goldvein", "Hammerfall", "Mountainborn", "Rocksplitter", "Steelheart", "Thunderaxe", "Flamebrand", "Shieldwall", "Anvilhand", "Forgefire", "Cragtooth", "Stonefist", "Ironbrow", "Deepdelver", "Goldvein", "Hammerfall"]
  },
  "Halfling": {
    firstNames: ["Bilbo", "Corrin", "Dillyn", "Eldon", "Finnan", "Gimble", "Hildy", "Jasper", "Kellen", "Lindy", "Milo", "Nedda", "Odo", "Perrin", "Quintus", "Remy", "Sandy", "Toby", "Ursula", "Willy"],
    lastParts: ["Lightfoot", "Goodbarrel", "Tealeaf", "Appleby", "Greenhills", "Hilltopper", "Quickstep", "Merryweather", "Sunshine", "Breechwood", "Willowbrook", "Fernleaf", "Thistlewick", "Daisyfield", "Rosewater", "Cloverfield", "Maplehurst", "Oakhaven", "Brambleton", "Hawthorne"]
  },
  "Dragonborn": {
    firstNames: ["Akra", "Bharash", "Crimsonscale", "Donaar", "Fenken", "Ghesh", "Heskan", "Ir索拉", "Kriv", "Medrash", "Nadarr", "Pandjed", "Rhogar", "Shamash", "Tarhun", "Ulgarn", "Veros", "Wardir", "Yarmon", "Zemeth"],
    lastParts: ["Flameclaw", "Stormscale", "Ironwing", "Shadowfang", "Thundermaw", "Bloodscale", "Firebreath", "Stonehide", "Frostwing", "Ashclaw", "Emberheart", "Scaleborn", "Wyrmcaller", "Drakeslayer", "Dragonblood", "Cloudfang", "Stormtail", "Flamescale", "Ironhorn", "Shadowwing"]
  },
  "Half-Elf": {
    firstNames: ["Aelarion", "Baelwen", "Caelith", "Daelora", "Elandra", "Faelarion", "Garethil", "Haelwen", "Ilyndor", "Jarethil", "Kaelthas", "Lirael", "Maevea", "Nimrodel", "Orithiel", "Paelora", "Quel'thalas", "Raeliana", "Sylvaris", "Thalandor"],
    lastParts: ["Halfstar", "Moonshadow", "Dawnstrider", "Nightbloom", "Silverveil", "Stormsong", "Windwalker", "Brightwood", "Emberglade", "Frostveil", "Thornshade", "Riverdance", "Starfall", "Mistwalker", "Sunwhisper", "Leafdancer", "Shadowleaf", "Moonwhisper", "Starweaver", "Duskwalker"]
  },
  "Gnome": {
    firstNames: ["Alston", "Boddynock", "Caramip", "Dimble", "Eldon", "Fonkin", "Gerbo", "Jebeddo", "Namfoodle", "Orryn", "Sindri", "Waynath", "Zook", "Bilia", "Carami", "Deerfoot", "Ellywick", "Furgara", "Lilli", "Nissa"],
    lastParts: ["Tinkerwrench", "Gearmender", "Clockwork", "Sparkplug", "Cogsworth", "Wickerman", "Boltmaker", "Springheel", "Gizmo", "Whirlygig", "Tinkertop", "Gadgeteer", "Mechanicus", "Artificer", "Inventor", "Brainstorm", "Wondermind", "Cleverhands", "Quickwit", "Brightspark"]
  },
  "Half-Orc": {
    firstNames: ["Dench", "Feng", "Gell", "Henk", "Holg", "Imsh", "Keth", "Krusk", "Mhurren", "Ront", "Shump", "Thogar", "Venomfang", "Vorg", "Yurrun", "Akta", "Boma", "Desh", "Gruk", "Hurg"],
    lastParts: ["Bloodfist", "Ironjaw", "Stonebreaker", "Thunderclaw", "Shadowmaw", "Bonecrusher", "Warhorn", "Skullsplitter", "Fangtooth", "Berserker", "Warcry", "Battleborn", "Oathkeeper", "Rageblood", "Stormcaller", "Nightblade", "Darkfang", "Ironhide", "Bloodthorn", "Shadowclaw"]
  }
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
  const raceData = NAME_DATA[race] || NAME_DATA["Human"];
  
  // Use class name to seed a deterministic but varied selection
  // This ensures same character gets consistent name across page reloads
  const classHash = [...characterClass].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const raceHash = [...race].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  
  // Combine hashes for unique selection per class+race combo
  const firstIdx = (classHash * 31 + raceHash * 17) % raceData.firstNames.length;
  const lastIdx = (classHash * 19 + raceHash * 23) % raceData.lastParts.length;
  
  return `${raceData.firstNames[firstIdx]} ${raceData.lastParts[lastIdx]}`;
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
      <div class="hero-section">
        ${this.renderLocaleDropdown()}
        <h1 class="hero-title">🎲 DnD Full Auto-DM</h1>
        <p class="hero-subtitle">${t("hero.subtitle")}</p>
      </div>

      <div class="active-games-section">
        <div class="section-header">
          <h2 class="section-title">${t("active_games.title")}</h2>
          <button id="refresh-games-btn" class="refresh-btn">${t("active_games.refresh")}</button>
        </div>
        <div id="active-games-container"></div>
      </div>

      <div class="welcome-screen">
        <div class="settings-trigger" title="${t("settings.title")}">⚙️</div>
        <h2>${t("create_own.title")}</h2>
        <p class="subtitle">${t("create_own.subtitle")}</p>

        <div class="options">
          <button id="create-game-btn" class="primary">${t("create_game.btn")}</button>
          <div class="divider">${t("or.divider")}</div>
          <div class="join-form">
            <input type="text" id="game-id-input" placeholder="${t("join_form.placeholder")}">
            <button id="join-game-btn">${t("join_form.btn")}</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("create-game-btn")?.addEventListener("click", () => this.showScenarioSelection());
    document.getElementById("refresh-games-btn")?.addEventListener("click", () => {
      (window as unknown as { app: { fetchActiveGames: () => Promise<void> } }).app?.fetchActiveGames();
    });
    document.getElementById("join-game-btn")?.addEventListener("click", () => {
      const gameId = (document.getElementById("game-id-input") as HTMLInputElement).value.trim();
      if (gameId) window.location.href = `?game=${gameId}`;
    });
    document.querySelector(".settings-trigger")?.addEventListener("click", () => {
      (window as unknown as { app: { showSettingsModal: () => void } }).app?.showSettingsModal();
    });

    // Language selector change handler
    document.getElementById("locale-select")?.addEventListener("change", () => {
      const newLocale = (document.getElementById("locale-select") as HTMLSelectElement).value;
      setLocale(newLocale);
      location.reload();
    });

    // Fetch active games on load
    (window as unknown as { app: { fetchActiveGames: () => Promise<void> } }).app?.fetchActiveGames();
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
        ${this.renderLocaleDropdown()}
        <h2>${t("choose_adventure.title")}</h2>
        <p class="subtitle">${t("choose_adventure.subtitle")}</p>
        <div class="scenario-grid">${cards}</div>
        <div class="form-actions">
          <button type="button" id="cancel-btn">${t("back.btn")}</button>
        </div>
      </div>
    `;

    document.getElementById("locale-select")?.addEventListener("change", () => {
      const newLocale = (document.getElementById("locale-select") as HTMLSelectElement).value;
      setLocale(newLocale);
      location.reload();
    });

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
        ${this.renderLocaleDropdown()}
        <h2>${t("create_game_page.title")}</h2>
        <p class="subtitle">Scenario: ${scenarioDescriptions[this.selectedScenario as keyof typeof scenarioDescriptions].icon} ${scenarioDescriptions[this.selectedScenario as keyof typeof scenarioDefinitions].label}</p>
        <form id="create-game-form">
          <label>${t("game_name.label")}
            <input type="text" id="game-name" placeholder="${t("game_name.placeholder")}" required>
          </label>
          <label>${t("max_players.label")}
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
          <h3>${t("your_character.title")}</h3>
          <div class="form-row">
            <label>${t("race.label")}
              <select id="race">${races}</select>
            </label>
            <label>${t("class.label")}
              <select id="character-class">${classes}</select>
            </label>
          </div>
          <button type="button" id="auto-fill-btn" class="secondary">${t("auto_fill.btn")}</button>
          <label>${t("player_name.label")}
            <input type="text" id="player-name" placeholder="${t("player_name.placeholder")}" required>
          </label>
          <label>${t("character_name.label")}
            <input type="text" id="character-name" placeholder="${t("character_name.placeholder")}" required>
          </label>
          <h3>${t("attributes.title")}</h3>
          <div class="attributes-grid">
            <label>STR <input type="number" id="attr-str" min="3" max="18" value="10"></label>
            <label>DEX <input type="number" id="attr-dex" min="3" max="18" value="10"></label>
            <label>CON <input type="number" id="attr-con" min="3" max="18" value="10"></label>
            <label>INT <input type="number" id="attr-int" min="3" max="18" value="10"></label>
            <label>WIS <input type="number" id="attr-wis" min="3" max="18" value="10"></label>
            <label>CHA <input type="number" id="attr-cha" min="3" max="18" value="10"></label>
          </div>
          <div class="form-actions">
            <button type="submit" class="primary">${t("create_game.btn")}</button>
            <button type="button" id="back-btn">${t("back.btn")}</button>
          </div>
        </form>
      </div>
    `;

    document.getElementById("locale-select")?.addEventListener("change", () => {
      const newLocale = (document.getElementById("locale-select") as HTMLSelectElement).value;
      setLocale(newLocale);
      location.reload();
    });

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
      locale: getLocale(),
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
