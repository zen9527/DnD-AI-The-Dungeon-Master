import { wsManager } from "./websocket.js";
import { gameState } from "./game-state.js";
import { t } from "./i18n.js";
import { escapeHtml } from "./utils.js";
import { icon, type IconName } from "./icons.js";
import type { PresetActionId } from "../../shared/index.js";

/** Dice the tray offers, in the order a player expects to see them. */
const DICE_TYPES = [4, 6, 8, 10, 12, 20] as const;

/**
 * The preset actions. `id` is language-independent and travels with the action
 * so the rules engine can pick the right skill check — the visible text is
 * localized and cannot be keyword-matched.
 */
const STATIC_PRESETS: Array<{ id: PresetActionId; label: () => string; action: () => string }> = [
  { id: "attack", label: () => t("action.attack"), action: () => t("action.attack_text") },
  { id: "search", label: () => t("action.search"), action: () => t("action.search_text") },
  { id: "talk", label: () => t("action.talk"), action: () => t("action.talk_text") },
  { id: "hide", label: () => t("action.hide"), action: () => t("action.hide_text") },
  { id: "arcana", label: () => t("action.intelligence"), action: () => t("action.intelligence_text") },
  { id: "defend", label: () => t("action.defend"), action: () => t("action.defend_text") },
];

/** Which glyph belongs to which preset — icon lives in code, text in locales. */
const PRESET_ICONS: Record<string, IconName> = {
  attack: "sword", search: "search", talk: "chat", hide: "run", arcana: "brain", defend: "shield",
};

export class ActionBar {
  private element: HTMLElement | null = null;
  private unsubscribe?: () => void;

  constructor(parent: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "action-bar";
    parent.appendChild(this.element);
    
    this.render(); // Initial render
    this.subscribeToStateChanges(); // React to inventory/spell changes
  }

  private subscribeToStateChanges(): void {
    this.unsubscribe = gameState.subscribe(({ game, currentPlayer }) => {
      if (game && currentPlayer) {
        this.render();
      }
    });
  }

  private render(): void {
    const game = gameState.game;
    const player = gameState.currentPlayer || game?.players?.[0];
    
    if (!player) return;

    // Drinkable items: consumables that actually restore HP.
    const potions: Array<{ name: string }> =
      (player.inventory || [])
        .filter(i => i.type === "consumable" && i.stats?.healingAmount)
        .map(i => ({ name: i.name }));

    // Gather spells from player's known spell list
    const spells = game?.players
      .find(p => p.id === player.id)?.spells || [];

    // Build static preset buttons HTML — label and action are both functions returning translated strings
    let presetsHtml = "";
    for (const preset of STATIC_PRESETS) {
      presetsHtml += `<button class="preset-btn" data-action="${escapeHtml(preset.action())}" data-action-id="${preset.id}">${icon(PRESET_ICONS[preset.id] ?? "sword")} ${escapeHtml(preset.label())}</button>`;
    }

    // Build potion buttons — only shown if player has potions available
    let potionsHtml = "";
    if (potions.length > 0) {
      potionsHtml = potions.map(p => 
        `<button class="action-item-btn potion-btn" data-action="${escapeHtml(p.name)}">${icon("potion")} ${escapeHtml(p.name)}</button>`
      ).join("");
    }

    // Build spell dropdown — only shown if player has spells available
    let spellsHtml = "";
    if (spells.length > 0) {
      const levelGroups: Record<number, string[]> = {};
      for (const spell of spells) {
        if (!levelGroups[spell.level]) levelGroups[spell.level] = [];
        levelGroups[spell.level].push(spell.name);
      }

      let dropdownOptions = "";
      for (const [level, names] of Object.entries(levelGroups)) {
        dropdownOptions += `<optgroup label="${t("spell.level_group", { level })}">`;
        for (const name of names) {
          dropdownOptions += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
        }
        dropdownOptions += `</optgroup>`;
      }

      spellsHtml = `
        <div class="spell-selector">
          <select id="spell-select" title="${t("spell.cast_tooltip")}">
            <option value="">${t("spell.cast_placeholder")}</option>
            ${dropdownOptions}
          </select>
        </div>
      `;
    }

    // Dice are rolled server-side, so nobody can fudge a result.
    const diceHtml = `
      <div class="dice-tray">
        <span class="dice-tray-label">${t("dice.tray_label")}</span>
        ${DICE_TYPES.map(d => `<button class="dice-btn" data-dice="${d}">d${d}</button>`).join("")}
        <label class="dice-modifier">
          <span>${t("dice.modifier")}</span>
          <input type="number" id="dice-modifier" value="0" min="-20" max="20" step="1">
        </label>
      </div>
    `;

      // Assemble the action bar HTML
    this.element!.innerHTML = `
      <div class="preset-actions">${presetsHtml}</div>
      <div class="dynamic-actions">
        ${potionsHtml}
        ${spellsHtml}
      </div>
      ${diceHtml}
      <div class="free-text">
        <input type="text" id="action-input" placeholder="${t("action.placeholder")} (/pm player message)">
        <button id="stop-stream-btn" class="secondary hidden" title="${t("stream.stop.tooltip")}">⏹ ${t("stream.stop.btn")}</button>
        <button id="action-submit" class="primary">${t("action.submit")}</button>
      </div>
    `;

    this.attachDynamicListeners();
  }

  private attachDynamicListeners(): void {
    // Potion buttons — send as free-text action "I use <name>" (localized)
    this.element!.querySelectorAll(".potion-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-action") || "";
        this.sendAction(t("action.use_item", { name }));
      });
    });

    // Spell dropdown — send as free-text action when changed (localized)
    const spellSelect = document.getElementById("spell-select") as HTMLSelectElement;
    if (spellSelect) {
      spellSelect.addEventListener("change", () => {
        const selectedSpell = spellSelect.value;
        if (selectedSpell) {
          this.sendAction(t("action.cast_spell", { spellName: selectedSpell }));
          // Reset dropdown after selection so it's ready for next use
          setTimeout(() => { spellSelect.value = ""; }, 100);
        }
      });
    }

    // Dice buttons — the server rolls and broadcasts the result to everyone.
    this.element!.querySelectorAll(".dice-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const diceType = parseInt(btn.getAttribute("data-dice") || "20");
        const modifierInput = document.getElementById("dice-modifier") as HTMLInputElement | null;
        const modifier = parseInt(modifierInput?.value || "0") || 0;
        wsManager.send({ type: "DICE_ROLL", payload: { diceType, count: 1, modifier } });
      });
    });

    // Preset buttons — send their action text
    this.element!.querySelectorAll(".preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action") || "";
        const actionId = (btn.getAttribute("data-action-id") as PresetActionId | null) ?? undefined;
        this.sendAction(action, actionId);
      });
    });

    // Free text input and submit button
    const input = document.getElementById("action-input") as HTMLInputElement;
    const submit = document.getElementById("action-submit") as HTMLButtonElement;

    submit?.addEventListener("click", () => this.sendAction(input?.value || ""));
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.sendAction(input.value);
      }
    });
  }

  private sendAction(action: string, actionId?: PresetActionId): void {
    if (!action.trim()) return;
    
    const trimmedAction = action.trim();
    
    // Parse /pm or /whisper command - send as PRIVATE_CHAT
    // Format: /pm <playerName> <message> or /whisper <playerName> <message>
    const pmMatch = trimmedAction.match(/^\/pm\s+(\S+)\s+(.+)$/i) || trimmedAction.match(/^\/whisper\s+(\S+)\s+(.+)$/i);
    if (pmMatch) {
      const targetName = pmMatch[1];
      const message = pmMatch[2];
      
      // Find player by character name or player name
      const game = gameState.game;
      const targetPlayer = game?.players.find(p => 
        p.characterName.toLowerCase() === targetName.toLowerCase() || 
        p.name.toLowerCase() === targetName.toLowerCase()
      );
      
      if (targetPlayer) {
        wsManager.send({ type: "PRIVATE_CHAT", payload: { targetPlayerId: targetPlayer.id, content: message } });
      } else {
        // Show error - player not found
        console.warn(`Player "${targetName}" not found`);
      }
      // Clear input after sending
      const input = document.getElementById("action-input") as HTMLInputElement;
      if (input) input.value = "";
      return;
    }
    
    // Regular action - send as PLAYER_ACTION. Remembered so an error card's
    // Retry button can resend exactly this turn if the DM drops it.
    const payload = { action: trimmedAction, actionId };
    gameState.lastPlayerAction = payload;
    wsManager.send({ type: "PLAYER_ACTION", payload });
    
    // Clear free text input after sending
    const input = document.getElementById("action-input") as HTMLInputElement;
    if (input) input.value = "";
  }

  destroy(): void {
    this.unsubscribe?.();
  }
}
