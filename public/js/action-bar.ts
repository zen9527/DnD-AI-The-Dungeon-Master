import { wsManager } from "./websocket.js";
import { gameState } from "./game-state.js";

// Static preset actions (always available)
const STATIC_PRESETS = [
  { label: "⚔️ Attack", action: "I attack my target" },
  { label: "🔍 Search", action: "I search the area carefully" },
  { label: "💬 Talk", action: "I try to talk to my target" },
  { label: "🏃 Hide", action: "I try to hide" },
  { label: "🧠 Use Intelligence", action: "I use my intelligence to figure this out" },
  { label: "🛡️ Defend", action: "I take a defensive stance" },
];

export class ActionBar {
  private element: HTMLElement | null = null;
  private unsubscribe?: () => void;

  constructor(parent: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "action-bar";
    parent.appendChild(this.element);
    
    this.render(); // Initial render
    this.subscribeToStateChanges(); // React to inventory/spell changes
    this.setupFreeTextListeners();
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

    // Gather available potions from inventory (potion-type items only)
    const potions: Array<{ name: string }> = 
      (player.inventory || []).filter(i => i.type === 'potion').map(i => ({ name: i.name }));

    // Gather spells from player's known spell list
    const spells = game?.players
      .find(p => p.id === player.id)?.spells || [];

    // Build static preset buttons HTML
    let presetsHtml = "";
    for (const preset of STATIC_PRESETS) {
      presetsHtml += `<button class="preset-btn" data-action="${this.escapeHtml(preset.action)}">${preset.label}</button>`;
    }

    // Build potion buttons — only shown if player has potions available
    let potionsHtml = "";
    if (potions.length > 0) {
      potionsHtml = potions.map(p => 
        `<button class="action-item-btn potion-btn" data-action="${this.escapeHtml(p.name)}">🧪 ${this.escapeHtml(p.name)}</button>`
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
        dropdownOptions += `<optgroup label="Level ${level}">`;
        for (const name of names) {
          dropdownOptions += `<option value="${this.escapeHtml(name)}">${this.escapeHtml(name)}</option>`;
        }
        dropdownOptions += `</optgroup>`;
      }

      spellsHtml = `
        <div class="spell-selector">
          <select id="spell-select" title="Cast a spell">
            <option value="">📖 Cast Spell...</option>
            ${dropdownOptions}
          </select>
        </div>
      `;
    }

    // Assemble the action bar HTML
    this.element!.innerHTML = `
      <div class="preset-actions">${presetsHtml}</div>
      <div class="dynamic-actions">
        ${potionsHtml}
        ${spellsHtml}
      </div>
      <div class="free-text">
        <input type="text" id="action-input" placeholder="Or describe your action freely...">
        <button id="action-submit" class="primary">Act</button>
      </div>
    `;

    this.attachDynamicListeners();
  }

  private attachDynamicListeners(): void {
    // Potion buttons — send as free-text action "I use <name>"
    this.element!.querySelectorAll(".potion-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-action") || "";
        this.sendAction(`I use ${name}`);
      });
    });

    // Spell dropdown — send as free-text action when changed
    const spellSelect = document.getElementById("spell-select") as HTMLSelectElement;
    if (spellSelect) {
      spellSelect.addEventListener("change", () => {
        const selectedSpell = spellSelect.value;
        if (selectedSpell) {
          this.sendAction(`I cast ${this.escapeHtml(selectedSpell)}`);
          // Reset dropdown after selection so it's ready for next use
          setTimeout(() => { spellSelect.value = ""; }, 100);
        }
      });
    }

    // Preset buttons — send their action text
    this.element!.querySelectorAll(".preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action") || "";
        this.sendAction(action);
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

  private sendAction(action: string): void {
    if (!action.trim()) return;
    
    wsManager.send({ type: "PLAYER_ACTION", payload: { action: action.trim() } });
    
    // Clear free text input after sending
    const input = document.getElementById("action-input") as HTMLInputElement;
    if (input) input.value = "";
  }

  private escapeHtml(text: string): string {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  destroy(): void {
    this.unsubscribe?.();
  }
}
