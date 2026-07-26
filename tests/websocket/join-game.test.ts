import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../../src/websocket/manager.js";
import { gameStore } from "../../src/game/store.js";
import { GameEngine } from "../../src/game/engine.js";
import { createPlayer } from "../../src/game/player-factory.js";
import type { Attributes } from "../../src/types/index.js";

class MockHttpServer {
  listeners: Record<string, Function[]> = {};
  on(event: string, fn: Function) { (this.listeners[event] ||= []).push(fn); }
  // ws calls this when the server is closed during teardown.
  removeListener(event: string, fn: Function) {
    this.listeners[event] = (this.listeners[event] || []).filter(l => l !== fn);
  }
}

const ATTRIBUTES: Attributes = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

function joinPayload(gameId: string, id: string) {
  return {
    gameId,
    playerName: `Player ${id}`,
    characterName: `Hero ${id}`,
    race: "Human",
    characterClass: "Fighter",
    attributes: ATTRIBUTES,
  };
}

/** Every ERROR frame the socket was sent, as plain message strings. */
function errorsSentTo(ws: { send: ReturnType<typeof vi.fn> }): string[] {
  return ws.send.mock.calls
    .map(([raw]: [string]) => JSON.parse(raw))
    .filter((m: { type: string }) => m.type === "ERROR")
    .map((m: { payload: { message: string } }) => m.payload.message);
}

describe("JOIN_GAME capacity", () => {
  let manager: WebSocketManager;
  let ws: { readyState: number; send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  let engine: GameEngine;

  beforeEach(() => {
    manager = new WebSocketManager(new MockHttpServer() as never);
    ws = { readyState: 1, send: vi.fn(), close: vi.fn() };
    (manager as never as { clients: Map<unknown, unknown> }).clients.set(ws, {
      id: "conn_1", gameId: null, playerId: null,
    });

    engine = new GameEngine(
      {
        id: "game_full", name: "Full Game", scenario: "dungeon", maxPlayers: 2,
        players: [
          createPlayer({ id: "p1", name: "A", characterName: "A", race: "Human", characterClass: "Fighter", attributes: ATTRIBUTES, isDM: true }),
          createPlayer({ id: "p2", name: "B", characterName: "B", race: "Elf", characterClass: "Rogue", attributes: ATTRIBUTES }),
        ],
        npcs: [], chatHistory: [], events: [],
        combatMode: false, initiativeOrder: [], currentRound: 1, currentTurnIndex: 0,
      },
      { provider: "openai-compatible", baseUrl: "http://test", apiKey: null, model: "test" }
    );
  });

  afterEach(() => {
    engine.stopTimer();
    manager.shutdown();
    vi.restoreAllMocks();
  });

  it("rejects a join once the game is at maxPlayers", () => {
    vi.spyOn(gameStore, "getGame").mockReturnValue(engine);

    (manager as never as { routeMessage: (ws: unknown, m: unknown) => void }).routeMessage(ws, {
      type: "JOIN_GAME",
      payload: joinPayload("game_full", "3"),
    });

    expect(errorsSentTo(ws)).toContain("Game is full");
    expect(engine.getPlayerCount()).toBe(2);
  });

  it("admits a join when there is room", () => {
    engine.removePlayer("p2");
    vi.spyOn(gameStore, "getGame").mockReturnValue(engine);

    (manager as never as { routeMessage: (ws: unknown, m: unknown) => void }).routeMessage(ws, {
      type: "JOIN_GAME",
      payload: joinPayload("game_full", "3"),
    });

    expect(errorsSentTo(ws)).toEqual([]);
    expect(engine.getPlayerCount()).toBe(2);
  });
});
