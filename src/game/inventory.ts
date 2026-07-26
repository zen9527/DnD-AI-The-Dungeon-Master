import type { Game, Item, Player } from "../types/index.js";
import { calculateModifier } from "./dice.js";
import type { GameState } from "./game-state.js";

const BASE_ARMOR_CLASS = 10;

/** Carrying, equipping and consuming items. */
export class InventoryService {
  constructor(private readonly state: GameState) {}

  /** Resolve a player or fail loudly — callers treat a missing player as a bug. */
  private requirePlayer(game: Game, playerId: string): Player {
    const player = game.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");
    return player;
  }

  addItem(playerId: string, item: Item): void {
    this.state.mutate(game => {
      const player = this.requirePlayer(game, playerId);
      player.inventory = player.inventory || [];
      player.inventory.push(item);
    });
  }

  removeItem(playerId: string, itemId: string): void {
    this.state.mutate(game => {
      const player = this.requirePlayer(game, playerId);
      if (!player.inventory) return;
      const index = player.inventory.findIndex(i => i.id === itemId);
      if (index >= 0) player.inventory.splice(index, 1);
    });
  }

  /** Move an inventory item into the weapon or armor slot, replacing what was there. */
  equip(playerId: string, itemId: string, slot: "weapon" | "armor"): void {
    this.state.mutate(game => {
      const player = this.requirePlayer(game, playerId);
      if (!player.inventory) throw new Error("Inventory not found");

      const item = player.inventory.find(i => i.id === itemId);
      if (!item) throw new Error("Item not found in inventory");

      if (slot === "weapon") {
        player.equippedWeapon = item;
      } else {
        player.equippedArmor = item;
      }
      this.recalculateAC(player);
    });
  }

  unequip(playerId: string, slot: "weapon" | "armor"): void {
    this.state.mutate(game => {
      const player = this.requirePlayer(game, playerId);
      if (slot === "weapon") {
        player.equippedWeapon = undefined;
      } else {
        player.equippedArmor = undefined;
      }
      this.recalculateAC(player);
    });
  }

  /** AC = 10 + DEX modifier + equipped armor bonus. */
  private recalculateAC(player: Player): void {
    const armorBonus = player.equippedArmor?.stats?.armorClassBonus || 0;
    player.ac = BASE_ARMOR_CLASS + calculateModifier(player.attributes.dex) + armorBonus;
  }

  /**
   * Consume a healing item, optionally on another player or NPC.
   * The item leaves the inventory and is recorded in `usedItems`.
   */
  useItem(playerId: string, itemId: string, targetId?: string): { healed: number; message: string } {
    return this.state.mutate(game => {
      const player = this.requirePlayer(game, playerId);

      const item = player.inventory?.find(i => i.id === itemId);
      if (!item) throw new Error("Item not found in inventory");
      if (item.type !== "consumable") throw new Error("Item is not consumable");
      if (!item.stats?.healingAmount) throw new Error("Item has no healing effect");

      const target = targetId
        ? game.players.find(p => p.id === targetId) || game.npcs.find(n => n.id === targetId)
        : player;
      if (!target) throw new Error("Target not found");

      const before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + item.stats.healingAmount);
      const actualHealed = target.hp - before;

      player.usedItems = player.usedItems || [];
      player.usedItems.push(itemId);

      const index = player.inventory!.findIndex(i => i.id === itemId);
      if (index >= 0) player.inventory!.splice(index, 1);

      return {
        healed: item.stats.healingAmount,
        message: `Used ${item.name} and healed ${actualHealed} HP`,
      };
    });
  }

  /** A copy of the inventory, safe for the caller to hold on to. */
  getInventory(playerId: string): Item[] {
    const player = this.requirePlayer(this.state.raw, playerId);
    return player.inventory ? [...player.inventory] : [];
  }

  getEquipped(playerId: string): { weapon?: Item; armor?: Item } {
    const player = this.requirePlayer(this.state.raw, playerId);
    return { weapon: player.equippedWeapon, armor: player.equippedArmor };
  }

  getTotalWeight(playerId: string): number {
    const player = this.requirePlayer(this.state.raw, playerId);
    return (player.inventory || []).reduce((total, item) => total + item.weight, 0);
  }
}
