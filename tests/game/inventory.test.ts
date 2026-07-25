import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameEngine } from "../../src/game/engine.js";
import { calculateAC, getAttackBonus } from "../../src/game/rules.js";
import type { Item } from "../../shared/schemas/game.js";

// Factory for creating test players
function createTestPlayer(overrides: Partial<any> = {}) {
  return {
    id: "player1",
    name: "Test Player",
    characterName: "Hero",
    isDM: true,
    race: "Human",
    characterClass: "Fighter",
    level: 1,
    attributes: { str: 16, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    hp: 10, maxHp: 10, ac: 11,
    proficiencyBonus: 2,
    spellSlots: {}, spells: [], inventory: [], equipped: { weapon: undefined, armor: undefined },
    conditions: [], hitDice: { total: 1, used: 0 },
    deathSaves: { successes: 0, failures: 0 }, xp: 0, locale: "en-US",
    ...overrides
  };
}

// Factory for creating test items
function createTestItem(overrides: Partial<Item> = {}): Item {
  const base: Item = {
    id: "item-1",
    name: "Test Item",
    type: "weapon",
    weight: 5,
    ...overrides
  };
  // Only add stats if not overridden
  if (!overrides.stats) {
    base.stats = { attackBonus: 1, damageDice: { type: 8, count: 1 } };
  }
  return base;
}

describe("Inventory System - RED Phase", () => {
  let engine: GameEngine;
  let player: any;

  beforeEach(() => {
    // Mock LLM client to avoid actual API calls
    const mockLLMClient = { streamChat: vi.fn() };
    
    player = createTestPlayer();
    
    // Create engine with minimal game data
    engine = new GameEngine(
      { 
        id: "test-game", 
        name: "Test", 
        scenario: "dungeon", 
        maxPlayers: 4, 
        npcs: [], 
        players: [player]
      },
      "http://test", null, "test"
    );
    
    // Mock the LLM client
    (engine as any).llmClient = mockLLMClient;
  });

  describe("addItemToInventory", () => {
    it("should add item to player inventory", () => {
      const sword = createTestItem({ name: "Longsword", type: "weapon" });
      
      engine.addItemToInventory("player1", sword);
      
      const inventory = engine.getPlayerInventory("player1");
      expect(inventory).toHaveLength(1);
      expect(inventory[0].name).toBe("Longsword");
    });

    it("should add multiple items to inventory", () => {
      const sword = createTestItem({ id: "sword-1", name: "Longsword" });
      const shield = createTestItem({ id: "shield-1", name: "Wooden Shield", type: "armor" });
      
      engine.addItemToInventory("player1", sword);
      engine.addItemToInventory("player1", shield);
      
      const inventory = engine.getPlayerInventory("player1");
      expect(inventory).toHaveLength(2);
    });

    it("should return empty inventory for player with no items", () => {
      const inventory = engine.getPlayerInventory("player1");
      expect(inventory).toHaveLength(0);
    });
  });

  describe("removeItemFromInventory", () => {
    it("should remove item from inventory by itemId", () => {
      const sword = createTestItem({ id: "sword-1" });
      
      engine.addItemToInventory("player1", sword);
      expect(engine.getPlayerInventory("player1")).toHaveLength(1);
      
      engine.removeItemFromInventory("player1", "sword-1");
      
      const inventory = engine.getPlayerInventory("player1");
      expect(inventory).toHaveLength(0);
    });

    it("should not remove items if itemId does not exist", () => {
      const sword = createTestItem({ id: "sword-1" });
      
      engine.addItemToInventory("player1", sword);
      
      // Try to remove non-existent item
      engine.removeItemFromInventory("player1", "non-existent");
      
      const inventory = engine.getPlayerInventory("player1");
      expect(inventory).toHaveLength(1);
    });
  });

  describe("equipItem", () => {
    it("should equip weapon to weapon slot", () => {
      const sword = createTestItem({ id: "sword-1", type: "weapon", name: "Longsword", stats: { attackBonus: 2 } });
      
      engine.addItemToInventory("player1", sword);
      engine.equipItem("player1", "sword-1", "weapon");
      
      const equipped = engine.getEquippedItems("player1");
      expect(equipped.weapon).toBeDefined();
      expect(equipped.weapon?.name).toBe("Longsword");
    });

    it("should equip armor to armor slot", () => {
      const chainMail = createTestItem({ 
        id: "armor-1", 
        type: "armor", 
        name: "Chain Mail",
        stats: { armorClassBonus: 5 } 
      });
      
      engine.addItemToInventory("player1", chainMail);
      engine.equipItem("player1", "armor-1", "armor");
      
      const equipped = engine.getEquippedItems("player1");
      expect(equipped.armor).toBeDefined();
      expect(equipped.armor?.name).toBe("Chain Mail");
    });

    it("should unequip previous item when equipping new item in same slot", () => {
      const oldSword = createTestItem({ id: "old-sword", name: "Old Sword" });
      const newSword = createTestItem({ id: "new-sword", name: "New Sword" });
      
      engine.addItemToInventory("player1", oldSword);
      engine.addItemToInventory("player1", newSword);
      
      engine.equipItem("player1", "old-sword", "weapon");
      expect(engine.getEquippedItems("player1").weapon?.name).toBe("Old Sword");
      
      engine.equipItem("player1", "new-sword", "weapon");
      
      const equipped = engine.getEquippedItems("player1");
      expect(equipped.weapon?.name).toBe("New Sword");
    });

    it("should throw error when equipping item not in inventory", () => {
      expect(() => {
        engine.equipItem("player1", "non-existent-item", "weapon");
      }).toThrow();
    });
  });

  describe("unequipItem", () => {
    it("should unequip weapon from weapon slot", () => {
      const sword = createTestItem({ id: "sword-1", type: "weapon" });
      
      engine.addItemToInventory("player1", sword);
      engine.equipItem("player1", "sword-1", "weapon");
      
      expect(engine.getEquippedItems("player1").weapon).toBeDefined();
      
      engine.unequipItem("player1", "weapon");
      
      const equipped = engine.getEquippedItems("player1");
      expect(equipped.weapon).toBeUndefined();
    });

    it("should unequip armor from armor slot", () => {
      const armor = createTestItem({ id: "armor-1", type: "armor" });
      
      engine.addItemToInventory("player1", armor);
      engine.equipItem("player1", "armor-1", "armor");
      
      expect(engine.getEquippedItems("player1").armor).toBeDefined();
      
      engine.unequipItem("player1", "armor");
      
      const equipped = engine.getEquippedItems("player1");
      expect(equipped.armor).toBeUndefined();
    });
  });

  describe("useConsumable", () => {
    it("should use potion of healing and heal player", () => {
      const potion = createTestItem({ 
        id: "potion-1", 
        name: "Potion of Healing", 
        type: "consumable",
        stats: { healingAmount: 10 }
      });
      
      engine.addItemToInventory("player1", potion);
      
      const result = engine.useConsumable("player1", "potion-1");
      
      expect(result.healed).toBe(10);
      // Verify consumable was removed from inventory
      expect(engine.getPlayerInventory("player1")).toHaveLength(0);
    });

    it("should not exceed max HP when healing", () => {
      const potion = createTestItem({
        id: "potion-1",
        type: "consumable",
        stats: { healingAmount: 20 }
      });
      
      engine.addItemToInventory("player1", potion);
      player.hp = 8; // Max HP is 10
      
      const result = engine.useConsumable("player1", "potion-1");
      
      expect(result.healed).toBe(20);
      expect(player.hp).toBe(10); // Capped at maxHp
    });

    it("should remove consumable from inventory after use", () => {
      const potion = createTestItem({ id: "potion-1", type: "consumable", stats: { healingAmount: 10 } });
      
      engine.addItemToInventory("player1", potion);
      expect(engine.getPlayerInventory("player1")).toHaveLength(1);
      
      engine.useConsumable("player1", "potion-1");
      
      const inventory = engine.getPlayerInventory("player1");
      expect(inventory).toHaveLength(0);
    });

    it("should throw error when using item not in inventory", () => {
      expect(() => {
        engine.useConsumable("player1", "non-existent");
      }).toThrow();
    });
  });

  describe("calculateTotalWeight", () => {
    it("should calculate total weight of all inventory items", () => {
      const sword = createTestItem({ id: "sword-1", weight: 5 });
      const shield = createTestItem({ id: "shield-1", weight: 8 });
      const potion = createTestItem({ id: "potion-1", weight: 1 });
      
      engine.addItemToInventory("player1", sword);
      engine.addItemToInventory("player1", shield);
      engine.addItemToInventory("player1", potion);
      
      const totalWeight = engine.calculateTotalWeight("player1");
      expect(totalWeight).toBe(14); // 5 + 8 + 1
    });

    it("should return zero for empty inventory", () => {
      const totalWeight = engine.calculateTotalWeight("player1");
      expect(totalWeight).toBe(0);
    });
  });

  describe("Equipment affects combat", () => {
    it("should apply weapon attack bonus to attack rolls", () => {
      const sword = createTestItem({ 
        id: "sword-1", 
        type: "weapon", 
        stats: { attackBonus: 3 } 
      });
      
      engine.addItemToInventory("player1", sword);
      engine.equipItem("player1", "sword-1", "weapon");
      
      const playerWithWeapon = engine.getAllPlayers()[0];
      const attackBonus = getAttackBonus(playerWithWeapon, 0);
      
      // Fighter level 1: proficiency (+2) + STR mod ((16-10)/2 = +3) + weapon bonus (+3) = +8
      expect(attackBonus).toBe(8);
    });

    it("should apply armor AC bonus to calculateAC", () => {
      const chainMail = createTestItem({ 
        id: "armor-1", 
        type: "armor", 
        name: "Chain Mail",
        stats: { armorClassBonus: 5 } 
      });
      
      engine.addItemToInventory("player1", chainMail);
      engine.equipItem("player1", "armor-1", "armor");
      
      const playerWithArmor = engine.getAllPlayers()[0];
      const ac = calculateAC(playerWithArmor);
      
      // Base 10 + DEX mod ((14-10)/2 = +2) + armor bonus (+5) = 17
      expect(ac).toBe(17);
    });

    it("should use default AC when no armor equipped", () => {
      const playerNoArmor = engine.getAllPlayers()[0];
      const ac = calculateAC(playerNoArmor);
      
      // Base 10 + DEX mod (+2) = 12
      expect(ac).toBe(12);
    });
  });
});
