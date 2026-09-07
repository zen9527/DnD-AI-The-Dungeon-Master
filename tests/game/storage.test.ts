import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs module before importing storage
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  renameSync: vi.fn(),
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

  it("writes to a temp file and renames over the target, so a crash cannot corrupt a campaign", () => {
    const mockGame = {
      id: "atomic-game",
      name: "Atomic",
      players: [],
      npcs: [],
      chatHistory: [],
      conversationHistory: [],
      createdAt: Date.now(),
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockGame));

    saveGame(mockGame as any);
    saveGame(mockGame as any);

    // Scratch files are named <target>.<pid>.<counter>.tmp — unique per write,
    // so concurrent writers into the same directory can never share one.
    const scratch = (path: string) => /^atomic-game\.json\.\d+\.\d+\.tmp$/.test(path.split(/[\\/]/).pop()!);

    const firstWrite = vi.mocked(fs.writeFileSync).mock.calls[0][0] as string;
    expect(scratch(firstWrite)).toBe(true);

    expect(fs.renameSync).toHaveBeenCalledTimes(2);
    const [from1, to1] = vi.mocked(fs.renameSync).mock.calls[0] as [string, string];
    expect(scratch(from1)).toBe(true);
    expect(to1.endsWith("atomic-game.json")).toBe(true);

    // The second save must not reuse the first writer's scratch file.
    const [from2] = vi.mocked(fs.renameSync).mock.calls[1] as [string, string];
    expect(from2).not.toBe(from1);
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
        // Fixed, descending timestamps so the list order is deterministic.
        createdAt: filePath.includes("game1") ? 2000 : 1000,
      });
    });

    const result = listGames();
    
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("Game One");
    expect(result[1].name).toBe("Game Two");
  });

  it("sorts by lastPlayedAt descending and falls back to createdAt for old saves", () => {
    const base = { players: [], npcs: [], chatHistory: [], conversationHistory: [] };
    vi.mocked(fs.readdirSync).mockReturnValue(["old.json", "stale.json", "fresh.json"]);
    vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
      if (String(filePath).includes("old")) return JSON.stringify({ id: "old", name: "Old", createdAt: 500, ...base });
      if (String(filePath).includes("stale")) return JSON.stringify({ id: "stale", name: "Stale", createdAt: 100, lastPlayedAt: 1000, ...base });
      return JSON.stringify({ id: "fresh", name: "Fresh", createdAt: 200, lastPlayedAt: 2000, ...base });
    });

    const result = listGames();

    // fresh (2000) → old (createdAt 500 fallback) → stale (1000)? No: 1000 > 500.
    expect(result.map(g => g.id)).toEqual(["fresh", "stale", "old"]);
    expect(result[2].lastPlayedAt).toBe(500);
  });

  it("stamps lastPlayedAt on every save", () => {
    const game = {
      id: "stamp-game", name: "Stamp", players: [], npcs: [],
      chatHistory: [], conversationHistory: [], createdAt: 1,
    };
    vi.mocked(fs.existsSync).mockReturnValue(false);

    saveGame(game as any);

    const written = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
    expect(written.lastPlayedAt).toBeGreaterThan(1);
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
