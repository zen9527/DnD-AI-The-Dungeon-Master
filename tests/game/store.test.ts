import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock storage module before importing store
vi.mock("../../src/utils/storage.js", () => ({
  saveGame: vi.fn(),
  loadGame: vi.fn(),
  listGames: vi.fn(),
}));

// Mock configManager
vi.mock("../../src/utils/config.js", () => ({
  configManager: {
    read: vi.fn(),
  },
}));

// Mock prompts module to avoid scenario description issues
vi.mock("../../src/llm/prompts.js", () => ({
  buildSystemPrompt: vi.fn().mockReturnValue("test system prompt"),
  SCENARIO_TONES: {},
  scenarioDescriptions: {},
}));

import * as storage from "../../src/utils/storage.js";
import { configManager } from "../../src/utils/config.js";
import { GameEngine } from "../../src/game/engine.js";
import { gameStore } from "../../src/game/store.js";
import type { Game, Player } from "../../src/types/index.js";

describe("GameStore - Save/Load Methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the games map before each test
    (gameStore as any).games.clear();
  });

  describe("saveAllGames", () => {
    it("should save all active games to storage", () => {
      const mockGame1: Game = {
        id: "game-1",
        name: "Adventure 1",
        maxPlayers: 4,
        scenario: "forest",
        players: [{ id: "p1", name: "Player 1" } as Player],
        npcs: [],
        chatHistory: [],
        createdAt: Date.now(),
      };
      
      const mockGame2: Game = {
        id: "game-2",
        name: "Adventure 2",
        maxPlayers: 4,
        scenario: "dungeon",
        players: [{ id: "p2", name: "Player 2" } as Player],
        npcs: [],
        chatHistory: [],
        createdAt: Date.now(),
      };

      // Create mock engines
      const engine1 = new GameEngine(mockGame1, { provider: "openai-compatible", baseUrl: "http://test", apiKey: "key", model: "model" });
      const engine2 = new GameEngine(mockGame2, { provider: "openai-compatible", baseUrl: "http://test", apiKey: "key", model: "model" });
      
      (gameStore as any).games.set("game-1", engine1);
      (gameStore as any).games.set("game-2", engine2);

      vi.mocked(storage.saveGame).mockImplementation(() => {});

      gameStore.saveAllGames();

      expect(storage.saveGame).toHaveBeenCalledTimes(2);
      // Check that saveGame was called with games having the correct core properties
      const calls = vi.mocked(storage.saveGame).mock.calls;
      expect(calls[0][0].id).toBe("game-1");
      expect(calls[0][0].name).toBe("Adventure 1");
      expect(calls[1][0].id).toBe("game-2");
      expect(calls[1][0].name).toBe("Adventure 2");
    });

    it("should handle empty game store", () => {
      vi.mocked(storage.saveGame).mockImplementation(() => {});

      gameStore.saveAllGames();

      expect(storage.saveGame).not.toHaveBeenCalled();
    });
  });

  describe("loadSavedGames", () => {
    it("should load all saved games from storage and recreate engines", () => {
      const mockSavedGames = [
        { id: "saved-1", name: "Saved Adventure 1", createdAt: Date.now() },
        { id: "saved-2", name: "Saved Adventure 2", createdAt: Date.now() },
      ];

      const mockGameData1: Game = {
        id: "saved-1",
        name: "Saved Adventure 1",
        maxPlayers: 4,
        scenario: "forest",
        players: [{ id: "p1", name: "Player 1" } as Player],
        npcs: [],
        chatHistory: [],
        createdAt: Date.now(),
      };

      const mockGameData2: Game = {
        id: "saved-2",
        name: "Saved Adventure 2",
        maxPlayers: 4,
        scenario: "dungeon",
        players: [{ id: "p2", name: "Player 2" } as Player],
        npcs: [],
        chatHistory: [],
        createdAt: Date.now(),
      };

      vi.mocked(storage.listGames).mockReturnValue(mockSavedGames);
      vi.mocked(storage.loadGame)
        .mockReturnValueOnce(mockGameData1)
        .mockReturnValueOnce(mockGameData2);
      vi.mocked(configManager.read).mockReturnValue({
        llmBaseUrl: "http://test",
        llmApiKey: "key",
        llmModel: "model",
      });

      gameStore.loadSavedGames();

      expect(storage.listGames).toHaveBeenCalled();
      expect(storage.loadGame).toHaveBeenCalledTimes(2);
      expect(storage.loadGame).toHaveBeenCalledWith("saved-1");
      expect(storage.loadGame).toHaveBeenCalledWith("saved-2");
      
      // Verify games were loaded into the store
      expect((gameStore as any).games.size).toBe(2);
      expect((gameStore as any).games.has("saved-1")).toBe(true);
      expect((gameStore as any).games.has("saved-2")).toBe(true);
    });

    it("should skip games that fail to load", () => {
      const mockSavedGames = [
        { id: "saved-1", name: "Saved Adventure 1", createdAt: Date.now() },
        { id: "saved-2", name: "Broken Game", createdAt: Date.now() },
      ];

      const mockGameData1: Game = {
        id: "saved-1",
        name: "Saved Adventure 1",
        maxPlayers: 4,
        scenario: "forest",
        players: [{ id: "p1", name: "Player 1" } as Player],
        npcs: [],
        chatHistory: [],
        createdAt: Date.now(),
      };

      vi.mocked(storage.listGames).mockReturnValue(mockSavedGames);
      vi.mocked(storage.loadGame)
        .mockReturnValueOnce(mockGameData1)
        .mockReturnValueOnce(null); // Second game fails to load
      vi.mocked(configManager.read).mockReturnValue({
        llmBaseUrl: "http://test",
        llmApiKey: "key",
        llmModel: "model",
      });

      gameStore.loadSavedGames();

      expect((gameStore as any).games.size).toBe(1);
      expect((gameStore as any).games.has("saved-1")).toBe(true);
      expect((gameStore as any).games.has("saved-2")).toBe(false);
    });

    it("should handle empty saved games list", () => {
      vi.mocked(storage.listGames).mockReturnValue([]);

      gameStore.loadSavedGames();

      expect((gameStore as any).games.size).toBe(0);
    });
  });

  describe("startAutoSave", () => {
    it("should start an interval that saves all games every 60 seconds", () => {
      const mockIntervalId = 12345;
      vi.spyOn(global, "setInterval").mockReturnValue(mockIntervalId as any);
      vi.mocked(storage.saveGame).mockImplementation(() => {});

      // Add a game to the store
      const mockGame: Game = {
        id: "game-1",
        name: "Adventure 1",
        maxPlayers: 4,
        scenario: "forest",
        players: [{ id: "p1", name: "Player 1" } as Player],
        npcs: [],
        chatHistory: [],
        createdAt: Date.now(),
      };
      const engine = new GameEngine(mockGame, { provider: "openai-compatible", baseUrl: "http://test", apiKey: "key", model: "model" });
      (gameStore as any).games.set("game-1", engine);

      const result = gameStore.startAutoSave();

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 60000);
      expect(result).toBeDefined();

      // Verify the interval callback calls saveAllGames
      const callback = vi.mocked(setInterval).mock.calls[0][0] as () => void;
      callback(); // Manually invoke the callback
      
      expect(storage.saveGame).toHaveBeenCalled();
    });

    it("should return the interval ID", () => {
      const mockIntervalId = 99999;
      vi.spyOn(global, "setInterval").mockReturnValue(mockIntervalId as any);

      const result = gameStore.startAutoSave();

      expect(result).toBeDefined();
    });
  });
});
