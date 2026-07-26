import { wsManager } from "../websocket.js";
import { gameState } from "../game-state.js";
import { t } from "../i18n.js";
import { escapeHtml } from "../utils.js";
import type { Item, Player } from "../../../shared/index.js";

/** The player's carried items, with equip/use actions. */
export class InventoryPanelView {
  private get panel(): HTMLElement | null {
    return document.getElementById("inventory-panel");
  }

  /** Re-render if the panel exists; a no-op before the game UI is built. */
  refresh(): void {
    if (this.panel) this.render();
  }

  render(): void {
    const panel = this.panel;
    const player = gameState.currentPlayer;
    if (!panel || !player) return;

    const items = player.inventory || [];

    panel.innerHTML = `
      <h3>${t("inventory.title")}</h3>
      ${items.length === 0
        ? `<p class="combat-empty">${t("inventory.empty")}</p>`
        : `
          <ul class="inventory-list">
            ${items.map(item => this.renderItem(item, player)).join("")}
          </ul>
          <div class="inventory-weight">${t("inventory.weight", {
            weight: items.reduce((sum, i) => sum + i.weight, 0),
          })}</div>
        `}
    `;

    this.bindEvents();
  }

  private renderItem(item: Item, player: Player): string {
    const stats = [
      item.stats?.attackBonus ? `<span>${t("item.stat_attack")}: +${item.stats.attackBonus}</span>` : "",
      item.stats?.armorClassBonus ? `<span>${t("item.stat_ac")}: +${item.stats.armorClassBonus}</span>` : "",
      item.stats?.healingAmount ? `<span>${t("item.stat_heal")}: ${item.stats.healingAmount}</span>` : "",
    ].join("");

    return `
      <li class="inventory-item" data-item-id="${escapeHtml(item.id)}">
        <div class="item-header">
          <span class="item-name">${escapeHtml(item.name)}</span>
          <span class="item-type">${t(`item.type_${item.type}`)}</span>
        </div>
        ${item.description ? `<div class="item-desc">${escapeHtml(item.description)}</div>` : ""}
        <div class="item-stats">${stats}</div>
        <div class="item-actions">${this.renderActions(item, player)}</div>
      </li>
    `;
  }

  private renderActions(item: Item, player: Player): string {
    if (item.type === "weapon" || item.type === "armor") {
      const slot = item.type;
      const equipped = (slot === "weapon" ? player.equippedWeapon : player.equippedArmor)?.id === item.id;
      const action = equipped ? `unequip-${slot}` : `equip-${slot}`;
      return `<button class="btn-small ${equipped ? "btn-active" : ""}" data-action="${action}" data-item-id="${escapeHtml(item.id)}">${t(equipped ? "inventory.unequip_btn" : "inventory.equip_btn")}</button>`;
    }

    if (item.type === "consumable") {
      return `<button class="btn-small btn-use" data-action="use-item" data-item-id="${escapeHtml(item.id)}">${t("inventory.use_btn")}</button>`;
    }

    return "";
  }

  private bindEvents(): void {
    const messageByAction = {
      "equip-weapon": "EQUIP_WEAPON",
      "equip-armor": "EQUIP_ARMOR",
      "unequip-weapon": "UNEQUIP_WEAPON",
      "unequip-armor": "UNEQUIP_ARMOR",
      "use-item": "USE_ITEM",
    } as const;

    this.panel?.querySelectorAll<HTMLElement>("[data-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.dataset.action as keyof typeof messageByAction | undefined;
        const itemId = button.dataset.itemId;
        if (!action || !itemId || !(action in messageByAction)) return;

        wsManager.send({ type: messageByAction[action], payload: { itemId } });
      });
    });
  }
}
