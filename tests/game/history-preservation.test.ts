import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import type { ChatMessage, Game } from "../../src/types/index.js";

/**
 * The engine keeps only a recent window of chat in memory. Writing that window
 * straight to disk deleted a little more of the campaign's early chapters on
 * every save, permanently. `saveGame` merges instead.
 */

let workDir: string;
let originalCwd: string;
let storage: typeof import("../../src/utils/storage.js");

function message(id: string, content: string): ChatMessage {
  return { id, content, type: "text", timestamp: Date.now() };
}

function gameWith(chatHistory: ChatMessage[]): Game {
  return {
    id: "campaign_1", name: "Long Campaign", maxPlayers: 4, scenario: "dungeon",
    players: [], npcs: [], chatHistory, conversationHistory: [],
    createdAt: Date.now(), combatMode: false, initiativeOrder: [],
    currentRound: 1, currentTurnIndex: 0,
  };
}

beforeEach(async () => {
  originalCwd = process.cwd();
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-storage-"));
  process.chdir(workDir);
  vi.resetModules();
  storage = await import("../../src/utils/storage.js");
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe("saveGame history preservation", () => {
  it("writes the full history on a first save", () => {
    storage.saveGame(gameWith([message("m1", "first"), message("m2", "second")]));

    expect(storage.loadGame("campaign_1")?.chatHistory).toHaveLength(2);
  });

  it("keeps messages the in-memory window has aged out", () => {
    storage.saveGame(gameWith([message("m1", "the opening scene"), message("m2", "second")]));

    // The engine has since dropped m1 and gained m3.
    storage.saveGame(gameWith([message("m2", "second"), message("m3", "third")]));

    const saved = storage.loadGame("campaign_1")!;
    expect(saved.chatHistory.map(m => m.id)).toEqual(["m1", "m2", "m3"]);
    expect(saved.chatHistory[0].content).toBe("the opening scene");
  });

  it("does not duplicate messages that are in both", () => {
    const overlap = [message("m1", "a"), message("m2", "b")];
    storage.saveGame(gameWith(overlap));
    storage.saveGame(gameWith(overlap));

    expect(storage.loadGame("campaign_1")!.chatHistory).toHaveLength(2);
  });

  it("keeps history across many saves as the window slides", () => {
    // Twenty messages pass through a window that only ever holds three.
    const all = Array.from({ length: 20 }, (_, i) => message(`m${i}`, `line ${i}`));
    for (let i = 0; i < all.length; i++) {
      storage.saveGame(gameWith(all.slice(Math.max(0, i - 2), i + 1)));
    }

    const saved = storage.loadGame("campaign_1")!;
    expect(saved.chatHistory).toHaveLength(20);
    expect(saved.chatHistory[0].id).toBe("m0");
    expect(saved.chatHistory[19].id).toBe("m19");
  });

  it("still updates everything else on the game", () => {
    storage.saveGame(gameWith([message("m1", "a")]));

    const advanced = { ...gameWith([message("m2", "b")]), currentRound: 7, name: "Renamed" };
    storage.saveGame(advanced);

    const saved = storage.loadGame("campaign_1")!;
    expect(saved.currentRound).toBe(7);
    expect(saved.name).toBe("Renamed");
    expect(saved.chatHistory).toHaveLength(2);
  });
});
