import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebSocketManager } from "../../src/websocket/manager.js";
import { gameStore } from "../../src/game/store.js";
import type { Player, Game } from "../../src/types/index.js";

// Mock HTTP server for WebSocketManager
class MockHttpServer {
  listeners: Record<string, Function[]> = {};
  on(event: string, fn: Function) { this.listeners[event] = this.listeners[event] || []; this.listeners[event].push(fn); }
  emit(event: string, ...args: unknown[]) { (this.listeners[event] || []).forEach(fn => fn(...args)); }
}

describe("WebSocketManager DM Control - Authorization", () => {
  let mockServer: MockHttpServer;
  let manager: WebSocketManager;
  let mockDmWs: any;
  let mockRegularPlayerWs: any;

  beforeEach(() => {
    mockServer = new MockHttpServer() as any;
    manager = new WebSocketManager(mockServer as any);
    
    // Create mock DM WebSocket
    mockDmWs = {
      readyState: 1, // OPEN
      send: vi.fn(),
      close: vi.fn(),
    };

    // Create mock regular player WebSocket
    mockRegularPlayerWs = {
      readyState: 1, // OPEN
      send: vi.fn(),
      close: vi.fn(),
    };
  });

  describe("NPC_UPDATE_HP", () => {
    it("should allow DM to update NPC HP", () => {
      const dmClientData = { id: "dm-conn", gameId: "game-1", playerId: "dm-player" };
      (manager as any).clients.set(mockDmWs, dmClientData);

      const mockPlayer: Player = {
        id: "dm-player",
        name: "DM",
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

      const mockNpc = {
        id: "goblin-1",
        name: "Goblin",
        description: "Hostile goblin",
        role: "hostile",
        hp: 7,
        maxHp: 7,
        ac: 15,
        attributes: { str: 8, dex: 14, con: 10, int: 8, wis: 10, cha: 6 },
        createdAt: Date.now(),
        conditions: [],
      };

      const mockGame: Game = {
        id: "game-1",
        name: "Test Game",
        maxPlayers: 4,
        scenario: "dungeon",
        players: [mockPlayer],
        npcs: [mockNpc],
        chatHistory: [],
        events: [],
        conversationHistory: [],
        createdAt: Date.now(),
        combatMode: false,
        initiativeOrder: [],
        currentRound: 1,
        currentTurnIndex: 0,
      };

      const mockEngine = {
        id: "game-1",
        game: mockGame,
        updateNPCHP: vi.fn(),
      };

      vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

      const message = {
        type: "NPC_UPDATE_HP",
        payload: { npcId: "goblin-1", newHp: 3 },
      };

      manager["routeMessage"](mockDmWs, message);

      expect(mockEngine.updateNPCHP).toHaveBeenCalledWith("goblin-1", 3);
      expect(mockDmWs.send).toHaveBeenCalled();
    });

    it("should reject non-DM attempts to update NPC HP", () => {
      const regularClientData = { id: "regular-conn", gameId: "game-1", playerId: "regular-player" };
      (manager as any).clients.set(mockRegularPlayerWs, regularClientData);

      const mockPlayer: Player = {
        id: "regular-player",
        name: "Player",
        characterName: "Hero",
        isDM: false, // NOT DM
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

      const mockGame: Game = {
        id: "game-1",
        name: "Test Game",
        maxPlayers: 4,
        scenario: "dungeon",
        players: [mockPlayer],
        npcs: [{
          id: "goblin-1",
          name: "Goblin",
          description: "Hostile goblin",
          role: "hostile",
          hp: 7,
          maxHp: 7,
          ac: 15,
          attributes: { str: 8, dex: 14, con: 10, int: 8, wis: 10, cha: 6 },
          createdAt: Date.now(),
          conditions: [],
        }],
        chatHistory: [],
        events: [],
        conversationHistory: [],
        createdAt: Date.now(),
        combatMode: false,
        initiativeOrder: [],
        currentRound: 1,
        currentTurnIndex: 0,
      };

      const mockEngine = {
        id: "game-1",
        game: mockGame,
        updateNPCHP: vi.fn(),
      };

      vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

      const message = {
        type: "NPC_UPDATE_HP",
        payload: { npcId: "goblin-1", newHp: 3 },
      };

      manager["routeMessage"](mockRegularPlayerWs, message);

      expect(mockEngine.updateNPCHP).not.toHaveBeenCalled();
      expect(mockRegularPlayerWs.send).toHaveBeenCalledWith(
        expect.stringContaining("ERROR")
      );
    });
  });

  describe("NPC_APPLY_CONDITION", () => {
    it("should allow DM to apply condition to NPC", () => {
      const dmClientData = { id: "dm-conn", gameId: "game-1", playerId: "dm-player" };
      (manager as any).clients.set(mockDmWs, dmClientData);

      const mockPlayer: Player = {
        id: "dm-player",
        name: "DM",
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

      const mockGame: Game = {
        id: "game-1",
        name: "Test Game",
        maxPlayers: 4,
        scenario: "dungeon",
        players: [mockPlayer],
        npcs: [{
          id: "goblin-1",
          name: "Goblin",
          description: "Hostile goblin",
          role: "hostile",
          hp: 7,
          maxHp: 7,
          ac: 15,
          attributes: { str: 8, dex: 14, con: 10, int: 8, wis: 10, cha: 6 },
          createdAt: Date.now(),
          conditions: [],
        }],
        chatHistory: [],
        events: [],
        conversationHistory: [],
        createdAt: Date.now(),
        combatMode: false,
        initiativeOrder: [],
        currentRound: 1,
        currentTurnIndex: 0,
      };

      const mockEngine = {
        id: "game-1",
        game: mockGame,
        applyConditionToNPC: vi.fn(),
      };

      vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

      const message = {
        type: "NPC_APPLY_CONDITION",
        payload: { npcId: "goblin-1", condition: "poisoned" },
      };

      manager["routeMessage"](mockDmWs, message);

      expect(mockEngine.applyConditionToNPC).toHaveBeenCalledWith("goblin-1", "poisoned");
    });

    it("should reject non-DM attempts to apply condition", () => {
      const regularClientData = { id: "regular-conn", gameId: "game-1", playerId: "regular-player" };
      (manager as any).clients.set(mockRegularPlayerWs, regularClientData);

      const mockPlayer: Player = {
        id: "regular-player",
        name: "Player",
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

      const mockGame: Game = {
        id: "game-1",
        name: "Test Game",
        maxPlayers: 4,
        scenario: "dungeon",
        players: [mockPlayer],
        npcs: [{
          id: "goblin-1",
          name: "Goblin",
          description: "Hostile goblin",
          role: "hostile",
          hp: 7,
          maxHp: 7,
          ac: 15,
          attributes: { str: 8, dex: 14, con: 10, int: 8, wis: 10, cha: 6 },
          createdAt: Date.now(),
          conditions: [],
        }],
        chatHistory: [],
        events: [],
        conversationHistory: [],
        createdAt: Date.now(),
        combatMode: false,
        initiativeOrder: [],
        currentRound: 1,
        currentTurnIndex: 0,
      };

      const mockEngine = {
        id: "game-1",
        game: mockGame,
        applyConditionToNPC: vi.fn(),
      };

      vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

      const message = {
        type: "NPC_APPLY_CONDITION",
        payload: { npcId: "goblin-1", condition: "poisoned" },
      };

      manager["routeMessage"](mockRegularPlayerWs, message);

      expect(mockEngine.applyConditionToNPC).not.toHaveBeenCalled();
      expect(mockRegularPlayerWs.send).toHaveBeenCalledWith(
        expect.stringContaining("ERROR")
      );
    });
  });

  describe("NPC_REMOVE_CONDITION", () => {
    it("should allow DM to remove condition from NPC", () => {
      const dmClientData = { id: "dm-conn", gameId: "game-1", playerId: "dm-player" };
      (manager as any).clients.set(mockDmWs, dmClientData);

      const mockPlayer: Player = {
        id: "dm-player",
        name: "DM",
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

      const mockGame: Game = {
        id: "game-1",
        name: "Test Game",
        maxPlayers: 4,
        scenario: "dungeon",
        players: [mockPlayer],
        npcs: [{
          id: "goblin-1",
          name: "Goblin",
          description: "Hostile goblin",
          role: "hostile",
          hp: 7,
          maxHp: 7,
          ac: 15,
          attributes: { str: 8, dex: 14, con: 10, int: 8, wis: 10, cha: 6 },
          createdAt: Date.now(),
          conditions: ["poisoned"],
        }],
        chatHistory: [],
        events: [],
        conversationHistory: [],
        createdAt: Date.now(),
        combatMode: false,
        initiativeOrder: [],
        currentRound: 1,
        currentTurnIndex: 0,
      };

      const mockEngine = {
        id: "game-1",
        game: mockGame,
        removeConditionFromNPC: vi.fn(),
      };

      vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

      const message = {
        type: "NPC_REMOVE_CONDITION",
        payload: { npcId: "goblin-1", condition: "poisoned" },
      };

      manager["routeMessage"](mockDmWs, message);

      expect(mockEngine.removeConditionFromNPC).toHaveBeenCalledWith("goblin-1", "poisoned");
    });

    it("should reject non-DM attempts to remove condition", () => {
      const regularClientData = { id: "regular-conn", gameId: "game-1", playerId: "regular-player" };
      (manager as any).clients.set(mockRegularPlayerWs, regularClientData);

      const mockPlayer: Player = {
        id: "regular-player",
        name: "Player",
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

      const mockGame: Game = {
        id: "game-1",
        name: "Test Game",
        maxPlayers: 4,
        scenario: "dungeon",
        players: [mockPlayer],
        npcs: [{
          id: "goblin-1",
          name: "Goblin",
          description: "Hostile goblin",
          role: "hostile",
          hp: 7,
          maxHp: 7,
          ac: 15,
          attributes: { str: 8, dex: 14, con: 10, int: 8, wis: 10, cha: 6 },
          createdAt: Date.now(),
          conditions: ["poisoned"],
        }],
        chatHistory: [],
        events: [],
        conversationHistory: [],
        createdAt: Date.now(),
        combatMode: false,
        initiativeOrder: [],
        currentRound: 1,
        currentTurnIndex: 0,
      };

      const mockEngine = {
        id: "game-1",
        game: mockGame,
        removeConditionFromNPC: vi.fn(),
      };

      vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

      const message = {
        type: "NPC_REMOVE_CONDITION",
        payload: { npcId: "goblin-1", condition: "poisoned" },
      };

      manager["routeMessage"](mockRegularPlayerWs, message);

      expect(mockEngine.removeConditionFromNPC).not.toHaveBeenCalled();
      expect(mockRegularPlayerWs.send).toHaveBeenCalledWith(
        expect.stringContaining("ERROR")
      );
    });
  });

  describe("NPC_DELETE", () => {
    it("should allow DM to delete NPC", () => {
      const dmClientData = { id: "dm-conn", gameId: "game-1", playerId: "dm-player" };
      (manager as any).clients.set(mockDmWs, dmClientData);

      const mockPlayer: Player = {
        id: "dm-player",
        name: "DM",
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

      const mockGame: Game = {
        id: "game-1",
        name: "Test Game",
        maxPlayers: 4,
        scenario: "dungeon",
        players: [mockPlayer],
        npcs: [{
          id: "goblin-1",
          name: "Goblin",
          description: "Hostile goblin",
          role: "hostile",
          hp: 7,
          maxHp: 7,
          ac: 15,
          attributes: { str: 8, dex: 14, con: 10, int: 8, wis: 10, cha: 6 },
          createdAt: Date.now(),
          conditions: [],
        }],
        chatHistory: [],
        events: [],
        conversationHistory: [],
        createdAt: Date.now(),
        combatMode: false,
        initiativeOrder: [],
        currentRound: 1,
        currentTurnIndex: 0,
      };

      const mockEngine = {
        id: "game-1",
        game: mockGame,
        deleteNPC: vi.fn(),
      };

      vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

      const message = {
        type: "NPC_DELETE",
        payload: { npcId: "goblin-1" },
      };

      manager["routeMessage"](mockDmWs, message);

      expect(mockEngine.deleteNPC).toHaveBeenCalledWith("goblin-1");
    });

    it("should reject non-DM attempts to delete NPC", () => {
      const regularClientData = { id: "regular-conn", gameId: "game-1", playerId: "regular-player" };
      (manager as any).clients.set(mockRegularPlayerWs, regularClientData);

      const mockPlayer: Player = {
        id: "regular-player",
        name: "Player",
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

      const mockGame: Game = {
        id: "game-1",
        name: "Test Game",
        maxPlayers: 4,
        scenario: "dungeon",
        players: [mockPlayer],
        npcs: [{
          id: "goblin-1",
          name: "Goblin",
          description: "Hostile goblin",
          role: "hostile",
          hp: 7,
          maxHp: 7,
          ac: 15,
          attributes: { str: 8, dex: 14, con: 10, int: 8, wis: 10, cha: 6 },
          createdAt: Date.now(),
          conditions: [],
        }],
        chatHistory: [],
        events: [],
        conversationHistory: [],
        createdAt: Date.now(),
        combatMode: false,
        initiativeOrder: [],
        currentRound: 1,
        currentTurnIndex: 0,
      };

      const mockEngine = {
        id: "game-1",
        game: mockGame,
        deleteNPC: vi.fn(),
      };

      vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

      const message = {
        type: "NPC_DELETE",
        payload: { npcId: "goblin-1" },
      };

      manager["routeMessage"](mockRegularPlayerWs, message);

      expect(mockEngine.deleteNPC).not.toHaveBeenCalled();
      expect(mockRegularPlayerWs.send).toHaveBeenCalledWith(
        expect.stringContaining("ERROR")
      );
    });
  });

  describe("PLAYER_AWARD_XP", () => {
    it("should allow DM to award XP to player", () => {
      const dmClientData = { id: "dm-conn", gameId: "game-1", playerId: "dm-player" };
      (manager as any).clients.set(mockDmWs, dmClientData);

      const mockPlayer: Player = {
        id: "dm-player",
        name: "DM",
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

      const mockGame: Game = {
        id: "game-1",
        name: "Test Game",
        maxPlayers: 4,
        scenario: "dungeon",
        players: [mockPlayer],
        npcs: [],
        chatHistory: [],
        events: [],
        conversationHistory: [],
        createdAt: Date.now(),
        combatMode: false,
        initiativeOrder: [],
        currentRound: 1,
        currentTurnIndex: 0,
      };

      const mockEngine = {
        id: "game-1",
        game: mockGame,
        awardXPToPlayer: vi.fn(),
      };

      vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

      const message = {
        type: "PLAYER_AWARD_XP",
        payload: { playerId: "dm-player", amount: 500 },
      };

      manager["routeMessage"](mockDmWs, message);

      expect(mockEngine.awardXPToPlayer).toHaveBeenCalledWith("dm-player", 500);
    });

    it("should reject non-DM attempts to award XP", () => {
      const regularClientData = { id: "regular-conn", gameId: "game-1", playerId: "regular-player" };
      (manager as any).clients.set(mockRegularPlayerWs, regularClientData);

      const mockPlayer: Player = {
        id: "regular-player",
        name: "Player",
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

      const mockGame: Game = {
        id: "game-1",
        name: "Test Game",
        maxPlayers: 4,
        scenario: "dungeon",
        players: [mockPlayer],
        npcs: [],
        chatHistory: [],
        events: [],
        conversationHistory: [],
        createdAt: Date.now(),
        combatMode: false,
        initiativeOrder: [],
        currentRound: 1,
        currentTurnIndex: 0,
      };

      const mockEngine = {
        id: "game-1",
        game: mockGame,
        awardXPToPlayer: vi.fn(),
      };

      vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

      const message = {
        type: "PLAYER_AWARD_XP",
        payload: { playerId: "regular-player", amount: 500 },
      };

      manager["routeMessage"](mockRegularPlayerWs, message);

      expect(mockEngine.awardXPToPlayer).not.toHaveBeenCalled();
      expect(mockRegularPlayerWs.send).toHaveBeenCalledWith(
        expect.stringContaining("ERROR")
      );
    });
  });

  describe("PLAYER_LEVEL_UP", () => {
    it("should allow DM to level up player", () => {
      const dmClientData = { id: "dm-conn", gameId: "game-1", playerId: "dm-player" };
      (manager as any).clients.set(mockDmWs, dmClientData);

      const mockPlayer: Player = {
        id: "dm-player",
        name: "DM",
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

      const mockGame: Game = {
        id: "game-1",
        name: "Test Game",
        maxPlayers: 4,
        scenario: "dungeon",
        players: [mockPlayer],
        npcs: [],
        chatHistory: [],
        events: [],
        conversationHistory: [],
        createdAt: Date.now(),
        combatMode: false,
        initiativeOrder: [],
        currentRound: 1,
        currentTurnIndex: 0,
      };

      const mockEngine = {
        id: "game-1",
        game: mockGame,
        levelUpPlayer: vi.fn(),
      };

      vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

      const message = {
        type: "PLAYER_LEVEL_UP",
        payload: { playerId: "dm-player" },
      };

      manager["routeMessage"](mockDmWs, message);

      expect(mockEngine.levelUpPlayer).toHaveBeenCalledWith("dm-player");
    });

    it("should reject non-DM attempts to level up player", () => {
      const regularClientData = { id: "regular-conn", gameId: "game-1", playerId: "regular-player" };
      (manager as any).clients.set(mockRegularPlayerWs, regularClientData);

      const mockPlayer: Player = {
        id: "regular-player",
        name: "Player",
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

      const mockGame: Game = {
        id: "game-1",
        name: "Test Game",
        maxPlayers: 4,
        scenario: "dungeon",
        players: [mockPlayer],
        npcs: [],
        chatHistory: [],
        events: [],
        conversationHistory: [],
        createdAt: Date.now(),
        combatMode: false,
        initiativeOrder: [],
        currentRound: 1,
        currentTurnIndex: 0,
      };

      const mockEngine = {
        id: "game-1",
        game: mockGame,
        levelUpPlayer: vi.fn(),
      };

      vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

      const message = {
        type: "PLAYER_LEVEL_UP",
        payload: { playerId: "regular-player" },
      };

      manager["routeMessage"](mockRegularPlayerWs, message);

      expect(mockEngine.levelUpPlayer).not.toHaveBeenCalled();
      expect(mockRegularPlayerWs.send).toHaveBeenCalledWith(
        expect.stringContaining("ERROR")
      );
    });
  });
});
