import { wsManager } from "./websocket.js";
import { getLocale, setLocale, t, tKey, toSupportedLocale, SUPPORTED_LOCALES, getLocalizedScenarios, getLocalizedRaceName, getLocalizedClassName } from "./i18n.js";
import { raceOptions, classOptions, scenarioOptions } from "../../shared/schemas/game.js";
import { renderLocaleDropdownHTML, getLocaleDisplayName } from "./utils.js";
import { SettingsModal } from "./views/settings-modal.js";
import { generateDefaultAttributes, generateDefaultCharacterName } from "./character-defaults.js";
import { SavedGamesView } from "./views/saved-games.js";

export class CharacterCreator {
  private element: HTMLElement | null = null;
  private selectedScenario: string = "dungeon";
  // Store handler references for cleanup (fixes event listener leak)
  private raceChangeHandler: (() => void) | null = null;
  private classChangeHandler: (() => void) | null = null;
  private isCharacterNameDirty: boolean = false;
  /** Loading a save needs a character to load as, so the list hands back here. */
  private readonly savedGames = new SavedGamesView(gameId => this.showLoadCharacterForm(gameId));

  constructor() {
    this.element = document.getElementById("app");
    if (!this.element) return;
    this.showForm();
  }

  private showForm(): void {
    this.element!.innerHTML = `
      <div class="hero-section">
        ${renderLocaleDropdownHTML(SUPPORTED_LOCALES, getLocale(), getLocaleDisplayName)}
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
      new SettingsModal().show();
    });

    // Language selector change handler
    document.getElementById("locale-select")?.addEventListener("change", () => {
      const newLocale = (document.getElementById("locale-select") as HTMLSelectElement).value;
      setLocale(toSupportedLocale(newLocale));
      location.reload();
    });

    // Fetch active games on load
    (window as unknown as { app: { fetchActiveGames: () => Promise<void> } }).app?.fetchActiveGames();

    // Fetch saved games on load
    void this.savedGames.refresh();
  }

  private showLoadCharacterForm(gameId: string): void {
    const races = raceOptions.map(r => `<option value="${r}">${getLocalizedRaceName(r)}</option>`).join("");
    const classes = classOptions.map(c => `<option value="${c}">${getLocalizedClassName(c)}</option>`).join("");

    this.element!.innerHTML = `
      <div class="welcome-screen">
        ${renderLocaleDropdownHTML(SUPPORTED_LOCALES, getLocale(), getLocaleDisplayName)}
        <h2>${t("load_game_page.title")}</h2>
        <p class="subtitle">${t("load_game_page.subtitle", { gameId })}</p>
        <form id="load-game-form">
          <label>${t("player_name.label")}
            <input type="text" id="player-name" placeholder="${t("player_name.placeholder")}" required>
          </label>
          <label>${t("character_name.label")}
            <input type="text" id="character-name" placeholder="${t("character_name.placeholder")}" required>
          </label>
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
            <button type="submit" class="primary">${t("load_game.join_btn")}</button>
            <button type="button" id="back-btn">${t("back.btn")}</button>
          </div>
        </form>
      </div>
    `;

    document.getElementById("locale-select")?.addEventListener("change", () => {
      const newLocale = (document.getElementById("locale-select") as HTMLSelectElement).value;
      setLocale(toSupportedLocale(newLocale));
      location.reload();
    });

    document.getElementById("back-btn")?.addEventListener("click", () => this.showForm());

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

    document.getElementById("load-game-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.loadGame(gameId);
    });
  }

  private loadGame(gameId: string): void {
    const payload = {
      gameId,
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

    wsManager.send({ type: "JOIN_GAME", payload });
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
        ${renderLocaleDropdownHTML(SUPPORTED_LOCALES, getLocale(), getLocaleDisplayName)}
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
      setLocale(toSupportedLocale(newLocale));
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
        ${renderLocaleDropdownHTML(SUPPORTED_LOCALES, getLocale(), getLocaleDisplayName)}
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
      setLocale(toSupportedLocale(newLocale));
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
    const desc = tKey(`race.${keySuffix}.description`, { defaultValue: "" });
    
    if (desc && desc !== `race.${keySuffix}.description`) {
      descBox.innerHTML = `<strong>${tKey(`race.${keySuffix}`)}</strong><br>${desc}`;
    } else {
      // Try alternative key format
      const altKey = race.toLowerCase();
      const altDesc = tKey(`race.${altKey}.description`, { defaultValue: "" });
      if (altDesc && altDesc !== `race.${altKey}.description`) {
        descBox.innerHTML = `<strong>${tKey(`race.${altKey}`)}</strong><br>${altDesc}`;
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
    const desc = tKey(`class.${keySuffix}.description`, { defaultValue: "" });
    
    if (desc && desc !== `class.${keySuffix}.description`) {
      descBox.innerHTML = `<strong>${tKey(`class.${keySuffix}`)}</strong><br>${desc}`;
    } else {
      // Try alternative key format
      const altKey = characterClass.toLowerCase();
      const altDesc = tKey(`class.${altKey}.description`, { defaultValue: "" });
      if (altDesc && altDesc !== `class.${altKey}.description`) {
        descBox.innerHTML = `<strong>${tKey(`class.${altKey}`)}</strong><br>${altDesc}`;
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

}
