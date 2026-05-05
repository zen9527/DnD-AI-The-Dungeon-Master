import { wsManager } from "./websocket.js";
import { getLocale, setLocale, t, SUPPORTED_LOCALES, getLocalizedScenarios, getLocalizedNames, getLocalizedRaceName, getLocalizedClassName } from "./i18n.js";
import { raceOptions, classOptions, scenarioOptions } from "../../shared/schemas/game.js";

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
  // Use localized name data from current locale
  const raceData = getLocalizedNames(race);

  // Fallback to English if no names found for this race in current locale
  if (raceData.firstNames.length === 0 || raceData.lastParts.length === 0) {
    return t("character.fallback_name", { characterClass, race });
  }

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
  // Store handler references for cleanup (fixes event listener leak)
  private raceChangeHandler: (() => void) | null = null;
  private classChangeHandler: (() => void) | null = null;
  private isCharacterNameDirty: boolean = false;

  constructor() {
    this.element = document.getElementById("app");
    if (!this.element) return;
    this.showForm();
  }

  private showForm(): void {
    this.element!.innerHTML = `
      <div class="hero-section">
        ${this.renderLocaleDropdown()}
        <h1 class="hero-title">🎲 DnD AI: The Dungeon Master</h1>
        <p class="hero-subtitle">${t("hero.subtitle")}</p>
      </div>

      <div class="active-games-section">
        <div class="section-header">
          <h2 class="section-title">${t("active_games.title")}</h2>
          <button id="refresh-games-btn" class="refresh-btn">${t("active_games.refresh")}</button>
        </div>
        <div id="active-games-container"></div>
      </div>

      <!-- Saved Games Section -->
      <div class="saved-games-section" id="saved-games-section" style="display:none;">
        <div class="section-header">
          <h2 class="section-title">${t("saved_games.title")}</h2>
        </div>
        <div id="saved-games-container"></div>
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

    // Fetch saved games on load
    this.fetchSavedGames();
  }

  private async fetchSavedGames(): Promise<void> {
    try {
      const response = await fetch("/api/saved-games");
      if (!response.ok) return;
      const games: Array<{ id: string; name: string; createdAt: number }> = await response.json();
      this.renderSavedGames(games);
    } catch {
      // API not available yet — skip
    }
  }

  private renderSavedGames(games: Array<{ id: string; name: string; createdAt: number }>): void {
    const container = document.getElementById("saved-games-container");
    if (!container) return;

    if (games.length === 0) {
      container.innerHTML = `<p class="no-games">${t("saved_games.empty")}</p>`;
      container.parentElement!.style.display = "block";
      return;
    }

    container.innerHTML = games.map(g => {
      const dateStr = new Date(g.createdAt).toLocaleDateString();
      return `
        <div class="game-card saved-game" data-saved-id="${this.escapeHtml(g.id)}">
          <div class="game-card-header">
            <span class="scenario-badge">💾</span>
            <h3>${this.escapeHtml(g.name)}</h3>
          </div>
          <div class="game-card-body">
            <span class="game-scenario-label">${t("saved_games.date_format", { date: dateStr })}</span>
            <button class="join-game-btn load-saved-btn" data-saved-id="${this.escapeHtml(g.id)}">
              ${t("saved_games.load_btn")}
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Make section visible
    const section = document.getElementById("saved-games-section");
    if (section) section.style.display = "block";

    // Attach load handlers
    container.querySelectorAll(".load-saved-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const savedId = (btn as HTMLElement).getAttribute("data-saved-id");
        if (savedId) {
          window.location.href = `?game=${savedId}`;
        }
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

  private showScenarioSelection(): void {
    const localizedScenarios = getLocalizedScenarios();
    const cards = scenarioOptions.map(s => {
      const desc = localizedScenarios[s] || localizedScenarios.dungeon;
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
    // Use localized race/class names for dropdown display
    const races = raceOptions.map(r => `<option value="${r}">${getLocalizedRaceName(r)}</option>`).join("");
    const classes = classOptions.map(c => `<option value="${c}">${getLocalizedClassName(c)}</option>`).join("");

    this.element!.innerHTML = `
      <div class="welcome-screen">
        ${this.renderLocaleDropdown()}
        <h2>${t("create_game_page.title")}</h2>
        <p class="subtitle">${t("scenario.prefix")}${getLocalizedScenarios()[this.selectedScenario]?.icon ?? "🏰"} ${getLocalizedScenarios()[this.selectedScenario]?.label ?? this.selectedScenario}</p>
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
          
          <!-- Race/Class Description Display -->
          <div class="selection-description">
            <div id="race-description" class="desc-box race-desc"></div>
            <div id="class-description" class="desc-box class-desc"></div>
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
            <label>${t("attributes.str")} <input type="number" id="attr-str" min="3" max="18" value="10"></label>
            <label>${t("attributes.dex")} <input type="number" id="attr-dex" min="3" max="18" value="10"></label>
            <label>${t("attributes.con")} <input type="number" id="attr-con" min="3" max="18" value="10"></label>
            <label>${t("attributes.int")} <input type="number" id="attr-int" min="3" max="18" value="10"></label>
            <label>${t("attributes.wis")} <input type="number" id="attr-wis" min="3" max="18" value="10"></label>
            <label>${t("attributes.cha")} <input type="number" id="attr-cha" min="3" max="18" value="10"></label>
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

    // Create named handlers for cleanup (fixes event listener leak)
    this.raceChangeHandler = () => {
      this.autoFillAttributesAndName();
      this.showRaceDescription(raceSelect.value);
    };
    this.classChangeHandler = () => {
      this.autoFillAttributesAndName();
      this.showClassDescription(classSelect.value);
    };

    // Remove old handlers first to prevent accumulation
    raceSelect.removeEventListener("change", this.raceChangeHandler as EventListener);
    classSelect.removeEventListener("change", this.classChangeHandler as EventListener);
    
    // Add fresh handlers
    raceSelect.addEventListener("change", this.raceChangeHandler!);
    classSelect.addEventListener("change", this.classChangeHandler!);
    autoFillBtn?.addEventListener("click", () => this.autoFillAttributesAndName());
    
    // Track character name edits
    const characterNameInput = document.getElementById("character-name") as HTMLInputElement;
    characterNameInput?.addEventListener("input", () => {
      this.isCharacterNameDirty = true;
    });

    // Show initial descriptions for default selections
    if (raceSelect.value) this.showRaceDescription(raceSelect.value);
    if (classSelect.value) this.showClassDescription(classSelect.value);

    document.getElementById("create-game-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.createGame();
    });
  }

  private showRaceDescription(race: string): void {
    const descBox = document.getElementById("race-description");
    if (!descBox) return;
    
    // Map display name to locale key (e.g., "Half-Elf" -> "half-elf")
    const keySuffix = race.toLowerCase().replace(/ /g, "-").replace(/\./g, "");
    const desc = t(`race.${keySuffix}.description`, { defaultValue: "" });
    
    if (desc && desc !== `race.${keySuffix}.description`) {
      descBox.innerHTML = `<strong>${t(`race.${keySuffix}`)}</strong><br>${desc}`;
    } else {
      // Try alternative key format
      const altKey = race.toLowerCase();
      const altDesc = t(`race.${altKey}.description`, { defaultValue: "" });
      if (altDesc && altDesc !== `race.${altKey}.description`) {
        descBox.innerHTML = `<strong>${t(`race.${altKey}`)}</strong><br>${altDesc}`;
      } else {
        descBox.innerHTML = "";
      }
    }
  }

  private showClassDescription(characterClass: string): void {
    const descBox = document.getElementById("class-description");
    if (!descBox) return;
    
    // Map display name to locale key (e.g., "Half-Orc" -> "half-orc")
    const keySuffix = characterClass.toLowerCase().replace(/ /g, "-").replace(/\./g, "");
    const desc = t(`class.${keySuffix}.description`, { defaultValue: "" });
    
    if (desc && desc !== `class.${keySuffix}.description`) {
      descBox.innerHTML = `<strong>${t(`class.${keySuffix}`)}</strong><br>${desc}`;
    } else {
      // Try alternative key format
      const altKey = characterClass.toLowerCase();
      const altDesc = t(`class.${altKey}.description`, { defaultValue: "" });
      if (altDesc && altDesc !== `class.${altKey}.description`) {
        descBox.innerHTML = `<strong>${t(`class.${altKey}`)}</strong><br>${altDesc}`;
      } else {
        descBox.innerHTML = "";
      }
    }
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
    
    // Auto-generate character name only if user hasn't edited it
    const generatedName = generateDefaultCharacterName(characterClass, race);
    if (characterNameInput && !this.isCharacterNameDirty) {
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
    
    // Reset dirty flag after auto-fill
    this.isCharacterNameDirty = false;
    
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
