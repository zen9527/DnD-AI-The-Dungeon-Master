import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs module before importing storage
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

import * as fs from "fs";
import { saveGame, loadGame, listGames, deleteGame } from "../../src/utils/storage.js";

describe("saveGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should save game to JSON file", () => {
    const mockGame = {
      id: "test-game-123",
      name: "Test Adventure",
      players: [],
      npcs: [],
      chatHistory: [],
      conversationHistory: [],
      createdAt: Date.now(),
    };

    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => {});
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});

    const result = saveGame(mockGame as any);
    
    expect(result).toBe("test-game-123");
    expect(fs.writeFileSync).toHaveBeenCalled();
    const calledPath = vi.mocked(fs.writeFileSync).mock.calls[0][0] as string;
    expect(calledPath).toContain("test-game-123.json");
  });
});

describe("loadGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load game from JSON file", () => {
    const mockGame = { 
      id: "test-game", 
      name: "Test", 
      players: [], 
      npcs: [], 
      chatHistory: [], 
      conversationHistory: [],
      createdAt: Date.now(), 
    };
    
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockGame));

    const result = loadGame("test-game");
    
    expect(result).toEqual(mockGame);
  });

  it("should return null for non-existent game", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = loadGame("non-existent");
    
    expect(result).toBeNull();
  });
});

describe("listGames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return list of saved games", () => {
    vi.mocked(fs.readdirSync).mockReturnValue(["game1.json", "game2.json"]);
    vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
      const name = filePath.includes("game1") ? "Game One" : "Game Two";
      return JSON.stringify({ 
        id: name.toLowerCase().replace(" ", "-"), 
        name, 
        players: [], 
        npcs: [], 
        chatHistory: [], 
        conversationHistory: [],
        createdAt: Date.now(), 
      });
    });

    const result = listGames();
    
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("Game One");
    expect(result[1].name).toBe("Game Two");
  });
});

describe("deleteGame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete game file", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.unlinkSync).mockImplementation(() => {});

    const result = deleteGame("test-game");
    
    expect(result).toBe(true);
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  it("should return false for non-existent game", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = deleteGame("non-existent");
    
    expect(result).toBe(false);
  });
});
