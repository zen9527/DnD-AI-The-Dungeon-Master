import { wsManager } from "./websocket.js";
import { gameState } from "./game-state.js";

const ACTION_PRESETS = [
  { label: "⚔️ Attack", action: "I attack my target" },
  { label: "🔍 Search", action: "I search the area carefully" },
  { label: "💬 Talk", action: "I try to talk to my target" },
  { label: "🏃 Hide", action: "I try to hide" },
  { label: "🧠 Use Intelligence", action: "I use my intelligence to figure this out" },
  { label: "🛡️ Defend", action: "I take a defensive stance" },
  { label: "🧪 Use Potion", action: "I use a potion" },
  { label: "📖 Cast Spell", action: "I cast a spell" },
];

export class ActionBar {
  private element: HTMLElement | null = null;

  constructor(parent: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "action-bar";
    this.element.innerHTML = `
      <div class="preset-actions">
        ${ACTION_PRESETS.map(a => `<button class="preset-btn" data-action="${a.action}">${a.label}</button>`).join("")}
      </div>
      <div class="free-text">
        <input type="text" id="action-input" placeholder="Or describe your action freely...">
        <button id="action-submit" class="primary">Act</button>
      </div>
    `;
    parent.appendChild(this.element);
    this.setupListeners();
  }

  private setupListeners(): void {
    this.element!.querySelectorAll(".preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action") || "";
        this.sendAction(action);
      });
    });

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
    wsManager.send({
      type: "PLAYER_ACTION",
      payload: { action: action.trim() },
    });
    const input = document.getElementById("action-input") as HTMLInputElement;
    if (input) input.value = "";
  }
}
