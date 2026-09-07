import { describe, it, expect, beforeEach, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { playerSessions } from "../../src/websocket/sessions.js";

// vitest.config.ts points DND_SAVED_GAMES_DIR at a throwaway directory; pin it
// explicitly so this file never depends on that ordering.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-sessions-"));
process.env.DND_SAVED_GAMES_DIR = dir;

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("session persistence", () => {
  beforeEach(() => {
    playerSessions.clear();
    const file = path.join(dir, ".sessions.json");
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  it("tokens survive a fresh registry (server restart)", () => {
    const token = playerSessions.issue("g1", "p1");

    playerSessions.clear();
    playerSessions.load();

    expect(playerSessions.resolve(token)).toEqual({ gameId: "g1", playerId: "p1" });
  });

  it("re-issuing a seat retires the old token on disk too", () => {
    const first = playerSessions.issue("g1", "p1");
    const second = playerSessions.issue("g1", "p1");

    playerSessions.clear();
    playerSessions.load();

    expect(playerSessions.resolve(first)).toBeUndefined();
    expect(playerSessions.resolve(second)).toEqual({ gameId: "g1", playerId: "p1" });
  });

  it("released tokens are gone from disk too", () => {
    const token = playerSessions.issue("g2", "p2");
    playerSessions.release(token);

    playerSessions.clear();
    playerSessions.load();

    expect(playerSessions.resolve(token)).toBeUndefined();
  });

  it("releaseGame drops the whole game's tokens from disk", () => {
    const a = playerSessions.issue("g3", "p1");
    const b = playerSessions.issue("g3", "p2");
    const kept = playerSessions.issue("g4", "p3");

    playerSessions.releaseGame("g3");
    playerSessions.clear();
    playerSessions.load();

    expect(playerSessions.resolve(a)).toBeUndefined();
    expect(playerSessions.resolve(b)).toBeUndefined();
    expect(playerSessions.resolve(kept)).toEqual({ gameId: "g4", playerId: "p3" });
  });

  it("a corrupt sessions file starts clean instead of throwing", () => {
    fs.writeFileSync(path.join(dir, ".sessions.json"), "{ not json");
    expect(() => playerSessions.load()).not.toThrow();
    expect(playerSessions.resolve("anything")).toBeUndefined();
  });

  it("the side file never lands inside a save listing", () => {
    // listGames only reads *.json — but the sessions file starts with a dot,
    // so double-charge: it must not be picked up even if renamed naively.
    playerSessions.issue("g5", "p1");
    const files = fs.readdirSync(dir);
    expect(files).toContain(".sessions.json");
    expect(files.filter(f => !f.startsWith("."))).toEqual([]);
  });
});
