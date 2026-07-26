import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameEngine } from "../../src/game/engine.js";
import type { Player, NPC } from "../../src/types/index.js";

describe("GameEngine DM Control - Authorization", () => {
  let engine: GameEngine;
  let dmPlayer: Player;
  let regularPlayer: Player;
  let npc: NPC;

  beforeEach(() => {
    // Create DM player
    dmPlayer = {
      id: "dm-player",
      name: "DM Name",
      characterName: "Storyteller",
      isDM: true,
      race: "Human",
      characterClass: "Fighter",
      level: 1,
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      hp: 10, maxHp: 10, ac: 11,
      proficiencyBonus: 2,
      spellSlots: {}, spells: [], inventory: [],
      conditions: [], hitDice: { total: 1, used: 0 },
      deathSaves: { successes: 0, failures: 0 }, xp: 0, locale: "en-US"
    };

    // Create regular player (non-DM)
    regularPlayer = {
      id: "regular-player",
      name: "Player Name",
      characterName: "Hero",
      isDM: false,
      race: "Elf",
      characterClass: "Rogue",
      level: 1,
      attributes: { str: 8, dex: 16, con: 12, int: 14, wis: 10, cha: 10 },
      hp: 8, maxHp: 8, ac: 13,
      proficiencyBonus: 2,
      spellSlots: {}, spells: [], inventory: [],
      conditions: [], hitDice: { total: 1, used: 0 },
      deathSaves: { successes: 0, failures: 0 }, xp: 0, locale: "en-US"
    };

    // Create NPC
    npc = {
      id: "goblin-1",
      name: "Goblin Warrior",
      description: "A hostile goblin",
      role: "hostile",
      hp: 7,
      maxHp: 7,
      ac: 15,
      attributes: { str: 8, dex: 14, con: 10, int: 8, wis: 10, cha: 6 },
      createdAt: Date.now(),
      conditions: [],
    };

    // Create engine with DM as first player
    engine = new GameEngine(
      { 
        id: "test-game", 
        name: "Test Dungeon", 
        scenario: "dungeon", 
        maxPlayers: 4, 
        npcs: [npc], 
        players: [dmPlayer, regularPlayer]
      },
      { provider: "openai-compatible", baseUrl: "http://test", apiKey: null, model: "test" }
    );

    // Mock LLM client
    (engine as any).llmClient = { streamChat: vi.fn() };
  });

  describe("NPC HP Update", () => {
    it("should allow DM to update NPC HP", () => {
      const initialHp = npc.hp;
      
      engine.updateNPCHP("goblin-1", 3);
      
      const updatedNpc = engine.game.npcs.find(n => n.id === "goblin-1");
      expect(updatedNpc?.hp).toBe(3);
      expect(initialHp).toBe(7); // Original was different
    });

    it("should clamp NPC HP to minimum 0", () => {
      engine.updateNPCHP("goblin-1", -5);
      
      const updatedNpc = engine.game.npcs.find(n => n.id === "goblin-1");
      expect(updatedNpc?.hp).toBe(0);
    });

    it("should update initiative order HP when combat is active", () => {
      engine.startCombat(false); // Start combat without rolling initiative
      engine.rollIndividualInitiative("goblin-1", false);

      engine.updateNPCHP("goblin-1", 2);
      
      const initiativeEntry = engine.game.initiativeOrder.find(e => e.npcId === "goblin-1");
      expect(initiativeEntry?.hp).toBe(2);
    });
  });

  describe("NPC Condition Management", () => {
    it("should allow DM to apply condition to NPC", () => {
      engine.applyConditionToNPC("goblin-1", "poisoned");
      
      const updatedNpc = engine.game.npcs.find(n => n.id === "goblin-1");
      expect(updatedNpc?.conditions).toContain("poisoned");
    });

    it("should allow DM to apply multiple conditions to NPC", () => {
      engine.applyConditionToNPC("goblin-1", "poisoned");
      engine.applyConditionToNPC("goblin-1", "prone");
      
      const updatedNpc = engine.game.npcs.find(n => n.id === "goblin-1");
      expect(updatedNpc?.conditions).toContain("poisoned");
      expect(updatedNpc?.conditions).toContain("prone");
    });

    it("should not duplicate conditions when applied twice", () => {
      engine.applyConditionToNPC("goblin-1", "poisoned");
      engine.applyConditionToNPC("goblin-1", "poisoned");
      
      const updatedNpc = engine.game.npcs.find(n => n.id === "goblin-1");
      const poisonedCount = updatedNpc?.conditions.filter(c => c === "poisoned").length;
      expect(poisonedCount).toBe(1);
    });

    it("should allow DM to remove condition from NPC", () => {
      engine.applyConditionToNPC("goblin-1", "poisoned");
      engine.removeConditionFromNPC("goblin-1", "poisoned");
      
      const updatedNpc = engine.game.npcs.find(n => n.id === "goblin-1");
      expect(updatedNpc?.conditions).not.toContain("poisoned");
    });

    it("should handle removing non-existent condition gracefully", () => {
      // Should not throw error
      expect(() => engine.removeConditionFromNPC("goblin-1", "blinded")).not.toThrow();
      
      const updatedNpc = engine.game.npcs.find(n => n.id === "goblin-1");
      expect(updatedNpc?.conditions).toEqual([]);
    });

    it("should handle applying condition to non-existent NPC gracefully", () => {
      // Should not throw error
      expect(() => engine.applyConditionToNPC("non-existent", "poisoned")).not.toThrow();
    });

    it("should handle removing condition from non-existent NPC gracefully", () => {
      // Should not throw error
      expect(() => engine.removeConditionFromNPC("non-existent", "poisoned")).not.toThrow();
    });
  });

  describe("NPC Creation", () => {
    it("should allow DM to create NPC with full stats", () => {
      engine.createNPC({
        name: "Orc Chieftain",
        description: "A powerful orc leader",
        role: "hostile",
        hp: 15,
        maxHp: 15,
        ac: 16,
        attributes: { str: 16, dex: 12, con: 14, int: 10, wis: 11, cha: 12 },
      });

      const newNpc = engine.game.npcs.find(n => n.name === "Orc Chieftain");
      expect(newNpc).toBeDefined();
      expect(newNpc?.hp).toBe(15);
      expect(newNpc?.maxHp).toBe(15);
      expect(newNpc?.ac).toBe(16);
      expect(newNpc?.attributes.str).toBe(16);
      expect(newNpc?.role).toBe("hostile");
    });

    it("should generate unique ID for new NPC", () => {
      const initialCount = engine.game.npcs.length;
      
      engine.createNPC({
        name: "Test NPC",
        description: "Test",
        role: "neutral",
        hp: 10,
        maxHp: 10,
        ac: 12,
        attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      });

      expect(engine.game.npcs.length).toBe(initialCount + 1);
      
      const newNpc = engine.game.npcs[engine.game.npcs.length - 1];
      expect(newNpc.id).toBeDefined();
      expect(newNpc.id).not.toBe("");
    });

    it("should set createdAt timestamp for new NPC", () => {
      const beforeTime = Date.now();
      
      engine.createNPC({
        name: "Test NPC",
        description: "Test",
        role: "neutral",
        hp: 10,
        maxHp: 10,
        ac: 12,
        attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      });

      const newNpc = engine.game.npcs[engine.game.npcs.length - 1];
      expect(newNpc.createdAt).toBeGreaterThanOrEqual(beforeTime);
    });

    it("should initialize conditions array as empty for new NPC", () => {
      engine.createNPC({
        name: "Test NPC",
        description: "Test",
        role: "neutral",
        hp: 10,
        maxHp: 10,
        ac: 12,
        attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      });

      const newNpc = engine.game.npcs[engine.game.npcs.length - 1];
      expect(newNpc.conditions).toEqual([]);
    });
  });

  describe("NPC Deletion", () => {
    it("should allow DM to delete NPC from game", () => {
      const initialCount = engine.game.npcs.length;
      
      engine.deleteNPC("goblin-1");
      
      expect(engine.game.npcs.length).toBe(initialCount - 1);
      expect(engine.game.npcs.find(n => n.id === "goblin-1")).toBeUndefined();
    });

    it("should remove NPC from initiative order when deleted", () => {
      engine.startCombat(false);
      engine.rollIndividualInitiative("goblin-1", false);
      expect(engine.game.initiativeOrder.find(e => e.npcId === "goblin-1")).toBeDefined();

      engine.deleteNPC("goblin-1");
      
      const initiativeEntry = engine.game.initiativeOrder.find(e => e.npcId === "goblin-1");
      expect(initiativeEntry).toBeUndefined();
    });

    it("should handle deleting non-existent NPC gracefully", () => {
      // Should not throw error
      expect(() => engine.deleteNPC("non-existent")).not.toThrow();
      
      // NPC count should remain unchanged
      const initialCount = engine.game.npcs.length;
      engine.deleteNPC("non-existent");
      expect(engine.game.npcs.length).toBe(initialCount);
    });
  });

  describe("XP Management", () => {
    it("should allow DM to award XP to player", () => {
      const initialXp = regularPlayer.xp;
      
      engine.awardXPToPlayer("regular-player", 500);
      
      const updatedPlayer = engine.game.players.find(p => p.id === "regular-player");
      expect(updatedPlayer?.xp).toBe(initialXp + 500);
    });

    it("should allow DM to award XP to multiple players", () => {
      engine.awardXPToAllPlayers(250);
      
      const dmUpdated = engine.game.players.find(p => p.id === "dm-player");
      const regularUpdated = engine.game.players.find(p => p.id === "regular-player");
      
      expect(dmUpdated?.xp).toBe(250);
      expect(regularUpdated?.xp).toBe(250);
    });

    it("should handle zero XP award", () => {
      const initialXp = regularPlayer.xp;
      
      engine.awardXPToPlayer("regular-player", 0);
      
      const updatedPlayer = engine.game.players.find(p => p.id === "regular-player");
      expect(updatedPlayer?.xp).toBe(initialXp);
    });

    it("should handle negative XP award (XP deduction)", () => {
      engine.awardXPToPlayer("regular-player", 100);
      engine.awardXPToPlayer("regular-player", -50);
      
      const updatedPlayer = engine.game.players.find(p => p.id === "regular-player");
      expect(updatedPlayer?.xp).toBe(50);
    });
  });

  describe("Level Management", () => {
    it("should allow DM to manually level up player", () => {
      const initialLevel = regularPlayer.level;
      
      engine.levelUpPlayer("regular-player");
      
      const updatedPlayer = engine.game.players.find(p => p.id === "regular-player");
      expect(updatedPlayer?.level).toBe(initialLevel + 1);
    });

    it("should recalculate proficiency bonus after level up", () => {
      // Level 1 = +2 proficiency
      engine.levelUpPlayer("regular-player"); // Now level 2
      
      const updatedPlayer = engine.game.players.find(p => p.id === "regular-player");
      expect(updatedPlayer?.proficiencyBonus).toBe(2); // Still +2 at level 2
      
      engine.levelUpPlayer("regular-player"); // Level 3
      engine.levelUpPlayer("regular-player"); // Level 4
      
      const level4Player = engine.game.players.find(p => p.id === "regular-player");
      expect(level4Player?.proficiencyBonus).toBe(2); // +2 at level 4
    });

    it("should handle level up for non-existent player gracefully", () => {
      // Should not throw error
      expect(() => engine.levelUpPlayer("non-existent")).not.toThrow();
    });

    it("should allow DM to reset player XP and level", () => {
      engine.awardXPToPlayer("regular-player", 1000);
      engine.levelUpPlayer("regular-player");
      
      const updatedPlayer = engine.game.players.find(p => p.id === "regular-player");
      expect(updatedPlayer?.xp).toBeGreaterThan(0);
      expect(updatedPlayer?.level).toBeGreaterThan(1);
      
      engine.resetPlayerXP("regular-player");
      
      const resetPlayer = engine.game.players.find(p => p.id === "regular-player");
      expect(resetPlayer?.xp).toBe(0);
      expect(resetPlayer?.level).toBe(1);
    });
  });

  describe("NPC List Retrieval", () => {
    it("should return all NPCs in game", () => {
      const npcs = engine.getAllNPCs();
      
      expect(npcs.length).toBe(1);
      expect(npcs[0].id).toBe("goblin-1");
    });

    it("should return empty array when no NPCs exist", () => {
      const emptyEngine = new GameEngine(
        { 
          id: "empty-game", 
          name: "Empty", 
          scenario: "dungeon", 
          maxPlayers: 4, 
          npcs: [], 
          players: [dmPlayer]
        },
        { provider: "openai-compatible", baseUrl: "http://test", apiKey: null, model: "test" }
      );
      
      const npcs = emptyEngine.getAllNPCs();
      expect(npcs.length).toBe(0);
    });
  });

  describe("Player List Retrieval", () => {
    it("should return all players in game", () => {
      const players = engine.getAllPlayers();
      
      expect(players.length).toBe(2);
      expect(players.map(p => p.id)).toContain("dm-player");
      expect(players.map(p => p.id)).toContain("regular-player");
    });
  });
});
