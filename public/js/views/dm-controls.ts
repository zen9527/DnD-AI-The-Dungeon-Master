import { wsManager } from "../websocket.js";
import { gameState } from "../game-state.js";
import { t } from "../i18n.js";
import { escapeHtml } from "../utils.js";
import { icon } from "../icons.js";
import type { NPC } from "../../../shared/index.js";

/** The D&D 5e condition list offered as toggles on every NPC. */
const CONDITIONS = [
  "blinded", "charmed", "deafened", "frightened", "grappled",
  "incapacitated", "invisible", "paralyzed", "petrified", "poisoned",
  "prone", "restrained", "stunned", "unconscious",
] as const;

/**
 * The DM's control surface: NPC health and conditions, NPC creation, XP awards
 * and level-ups. Rendered only for the DM, opened from a button that sits with
 * the game's other tools in the header.
 */
export class DMControlsView {
  private toggleButton: HTMLButtonElement | null = null;

  private get panel(): HTMLElement | null {
    return document.getElementById("dm-control-panel");
  }

  /**
   * Install the toggle in the header's tool cluster. Called on every game-UI
   * rebuild, which replaces the header, so the button is re-homed each time.
   *
   * It used to float over the bottom-right corner, where on a phone it landed
   * squarely on top of the "Act" button.
   */
  setupToggle(): void {
    if (!this.toggleButton) {
      const button = document.createElement("button");
      button.id = "dm-control-toggle";
      button.className = "dm-control-panel-toggle secondary icon-only";
      button.title = t("dm_control.title");
      button.innerHTML = `<span class="btn-icon" aria-hidden="true">${icon("dial")}</span>`;
      button.addEventListener("click", () => this.toggle());
      this.toggleButton = button;
    }

    const host = document.querySelector(".game-actions") ?? document.body;
    if (this.toggleButton.parentElement !== host) host.appendChild(this.toggleButton);

    const isDM = gameState.currentPlayer?.isDM ?? false;
    this.toggleButton.style.display = isDM ? "inline-flex" : "none";
    if (!isDM) this.panel?.classList.add("hidden");
  }

  private toggle(): void {
    const panel = this.panel;
    if (!panel) return;

    if (panel.classList.contains("hidden")) {
      panel.classList.remove("hidden");
      this.render();
    } else {
      panel.classList.add("hidden");
    }
  }

  /** Re-render if the panel is currently open; a no-op otherwise. */
  refresh(): void {
    const panel = this.panel;
    if (panel && !panel.classList.contains("hidden")) this.render();
  }

  render(): void {
    const panel = this.panel;
    if (!panel || !gameState.currentPlayer?.isDM) return;

    const npcs = gameState.npcs || [];
    const players = gameState.players || [];

    panel.innerHTML = `
      <div class="dm-quick-actions">
        <button id="start-combat-btn" class="primary">${icon("sword")} ${t("combat.start")}</button>
        <button id="create-npc-btn" class="secondary">${t("npc.create_btn")}</button>
      </div>

      <div class="dm-control-section">
        <h4>${t("dm_control.npc_conditions")}</h4>
        <ul class="npc-list">
          ${npcs.map(npc => this.renderNPC(npc)).join("")}
        </ul>
      </div>

      <div class="dm-control-section">
        <h4>${t("dm_control.npc_create")}</h4>
        <form id="create-npc-form">
          <div class="form-group">
            <label>${t("dm_control.npc_name")}</label>
            <input type="text" name="name" required placeholder="${t("dm_control.npc_name_placeholder")}">
          </div>
          <div class="form-group">
            <label>${t("dm_control.npc_description")}</label>
            <input type="text" name="description" placeholder="${t("dm_control.npc_description_placeholder")}">
          </div>
          <div class="form-group">
            <label>${t("dm_control.npc_role")}</label>
            <select name="role">
              <option value="hostile">${t("dm_control.role_hostile")}</option>
              <option value="neutral">${t("dm_control.role_neutral")}</option>
              <option value="friendly">${t("dm_control.role_friendly")}</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>${t("dm_control.npc_hp_label")}</label>
              <input type="number" name="hp" min="0" value="10" required>
            </div>
            <div class="form-group">
              <label>${t("dm_control.npc_max_hp")}</label>
              <input type="number" name="maxHp" min="0" value="10" required>
            </div>
            <div class="form-group">
              <label>${t("dm_control.npc_ac")}</label>
              <input type="number" name="ac" min="0" value="12" required>
            </div>
          </div>
          <button type="submit" class="btn-small">${t("dm_control.btn_create")}</button>
        </form>
      </div>

      <div class="dm-control-section">
        <h4>${t("dm_control.xp_award")}</h4>
        <form id="award-xp-form">
          <div class="form-group">
            <label>${t("dm_control.player_select")}</label>
            <select name="playerId">
              ${players.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.characterName || p.name)}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label>${t("dm_control.xp_amount")}</label>
            <input type="number" name="amount" min="0" value="100" required>
          </div>
          <button type="submit" class="btn-small">${t("dm_control.btn_award")}</button>
        </form>
      </div>

      <div class="dm-control-section">
        <h4>${t("dm_control.level_up")}</h4>
        <form id="level-up-form">
          <div class="form-group">
            <label>${t("dm_control.player_select")}</label>
            <select name="playerId">
              ${players.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.characterName || p.name)} (${t("level.abbreviation")}${p.level})</option>`).join("")}
            </select>
          </div>
          <button type="submit" class="btn-small">${t("dm_control.btn_level_up")}</button>
        </form>
      </div>
    `;

    this.bindEvents();
  }

  private renderNPC(npc: NPC): string {
    const hpPercent = npc.maxHp > 0 ? Math.round((npc.hp / npc.maxHp) * 100) : 0;
    const roleKey = `dm_control.role_${npc.role}` as const;

    return `
      <li class="npc-item" data-npc-id="${escapeHtml(npc.id)}">
        <div class="npc-header">
          <span class="npc-name">${escapeHtml(npc.name)}</span>
          <span class="npc-role ${npc.role}">${t(roleKey)}</span>
        </div>
        <div class="hp-slider-container">
          <input type="range" class="hp-slider" min="0" max="${npc.maxHp}" value="${npc.hp}" data-npc-id="${escapeHtml(npc.id)}">
          <div class="hp-display">${npc.hp}/${npc.maxHp} (${hpPercent}%)</div>
        </div>
        <div class="conditions-list">
          ${CONDITIONS.map(condition => this.renderCondition(npc, condition)).join("")}
        </div>
        <button class="btn-small btn-danger-small" data-action="delete-npc" data-npc-id="${escapeHtml(npc.id)}">${t("dm_control.btn_delete")}</button>
      </li>
    `;
  }

  private renderCondition(npc: NPC, condition: (typeof CONDITIONS)[number]): string {
    const checked = npc.conditions?.includes(condition) ? "checked" : "";
    return `
      <label class="condition-checkbox">
        <input type="checkbox" ${checked} data-npc-id="${escapeHtml(npc.id)}" data-condition="${condition}">
        ${t(`dm_control.condition_${condition}`)}
      </label>
    `;
  }

  private bindEvents(): void {
    const panel = this.panel;
    if (!panel) return;

    panel.querySelectorAll<HTMLInputElement>(".hp-slider").forEach(slider => {
      const readout = () => {
        const newHp = parseInt(slider.value);
        const maxHp = parseInt(slider.max);
        const display = slider.parentElement?.querySelector(".hp-display");
        if (display) display.textContent = `${newHp}/${maxHp} (${Math.round((newHp / maxHp) * 100)}%)`;
      };

      // The readout follows the thumb, but the message waits for release:
      // every NPC_UPDATE_HP broadcasts the whole game state to every client,
      // so sending on "input" floods the table for the length of a drag.
      slider.addEventListener("input", readout);
      slider.addEventListener("change", () => {
        readout();
        wsManager.send({
          type: "NPC_UPDATE_HP",
          payload: { npcId: slider.dataset.npcId, newHp: parseInt(slider.value) },
        });
      });
    });

    panel.querySelectorAll<HTMLInputElement>(".condition-checkbox input").forEach(checkbox => {
      checkbox.addEventListener("change", () => {
        wsManager.send({
          type: checkbox.checked ? "NPC_APPLY_CONDITION" : "NPC_REMOVE_CONDITION",
          payload: { npcId: checkbox.dataset.npcId, condition: checkbox.dataset.condition },
        });
      });
    });

    panel.querySelectorAll<HTMLElement>("[data-action='delete-npc']").forEach(button => {
      button.addEventListener("click", () => {
        const npcName = button.closest(".npc-item")?.querySelector(".npc-name")?.textContent || "NPC";
        if (confirm(t("dm_control.confirm_delete_npc", { name: npcName }))) {
          wsManager.send({ type: "NPC_DELETE", payload: { npcId: button.dataset.npcId } });
        }
      });
    });

    this.bindForm("create-npc-form", form => ({
      type: "NPC_CREATE" as const,
      payload: {
        name: form.get("name") as string,
        description: (form.get("description") as string) || "",
        role: form.get("role") as "friendly" | "neutral" | "hostile",
        hp: parseInt(form.get("hp") as string),
        maxHp: parseInt(form.get("maxHp") as string),
        ac: parseInt(form.get("ac") as string),
      },
    }));

    this.bindForm("award-xp-form", form => ({
      type: "PLAYER_AWARD_XP" as const,
      payload: {
        playerId: form.get("playerId") as string,
        amount: parseInt(form.get("amount") as string),
      },
    }));

    this.bindForm("level-up-form", form => ({
      type: "PLAYER_LEVEL_UP" as const,
      payload: { playerId: form.get("playerId") as string },
    }));

    panel.querySelector("#start-combat-btn")?.addEventListener("click", () => {
      wsManager.send({ type: "COMBAT_START", payload: { startInitiative: true } });
    });

    // Jump straight to the NPC name field rather than opening a separate dialog.
    panel.querySelector("#create-npc-btn")?.addEventListener("click", () => {
      panel.querySelector<HTMLInputElement>('#create-npc-form input[name="name"]')?.focus();
    });
  }

  /** Wire a form's submit to a WebSocket message, then reset it. */
  private bindForm(
    formId: string,
    toMessage: (data: FormData) => Parameters<typeof wsManager.send>[0]
  ): void {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    form?.addEventListener("submit", event => {
      event.preventDefault();
      wsManager.send(toMessage(new FormData(form)));
      form.reset();
    });
  }
}
