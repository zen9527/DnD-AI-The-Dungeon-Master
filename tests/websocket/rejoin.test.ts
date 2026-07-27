import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../../src/websocket/manager.js";
import { playerSessions } from "../../src/websocket/sessions.js";
import { gameStore } from "../../src/game/store.js";
import { GameEngine } from "../../src/game/engine.js";
import { createPlayer } from "../../src/game/player-factory.js";
import type { Attributes } from "../../src/types/index.js";

class MockHttpServer {
  listeners: Record<string, Function[]> = {};
  on(event: string, fn: Function) { (this.listeners[event] ||= []).push(fn); }
  removeListener(event: string, fn: Function) {
    this.listeners[event] = (this.listeners[event] || []).filter(l => l !== fn);
  }
}

const ATTRIBUTES: Attributes = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
const LLM = { provider: "openai-compatible" as const, baseUrl: "http://test", apiKey: null, model: "test" };

function mockSocket() {
  return { readyState: 1, send: vi.fn(), close: vi.fn() };
}

/** Decode every frame the server sent this socket. */
function framesTo(ws: { send: ReturnType<typeof vi.fn> }): Array<{ type: string; payload: Record<string, unknown> }> {
  return ws.send.mock.calls.map(([raw]: [string]) => JSON.parse(raw));
}

function frameOfType(ws: { send: ReturnType<typeof vi.fn> }, type: string) {
  return framesTo(ws).find(f => f.type === type);
}

describe("rejoining after a refresh", () => {
  let manager: WebSocketManager;
  let engine: GameEngine;

  const route = (ws: unknown, message: unknown) =>
    (manager as never as { routeMessage: (ws: unknown, m: unknown) => void }).routeMessage(ws, message);

  beforeEach(() => {
    playerSessions.clear();
    manager = new WebSocketManager(new MockHttpServer() as never);

    engine = new GameEngine(
      {
        id: "game_1", name: "Test", scenario: "dungeon", maxPlayers: 4,
        players: [createPlayer({
          id: "p1", name: "Ana", characterName: "Ranulf", race: "Human",
          characterClass: "Fighter", attributes: ATTRIBUTES, isDM: true,
        })],
        npcs: [], chatHistory: [],
        combatMode: false, initiativeOrder: [], currentRound: 1, currentTurnIndex: 0,
      },
      LLM
    );
    vi.spyOn(gameStore, "getGame").mockReturnValue(engine);
  });

  afterEach(() => {
    engine.stopTimer();
    manager.shutdown();
    playerSessions.clear();
    vi.restoreAllMocks();
  });

  it("keeps the seat when the socket closes", () => {
    engine.setPlayerConnected("p1", false);

    expect(engine.getPlayerCount()).toBe(1); // still holds a seat
    expect(engine.getConnectedPlayerCount()).toBe(0); // but is not present
  });

  it("restores the original character rather than making a new one", () => {
    const token = playerSessions.issue("game_1", "p1");
    engine.setPlayerConnected("p1", false);

    const ws = mockSocket();
    (manager as never as { clients: Map<unknown, unknown> }).clients.set(ws, {
      id: "conn_2", gameId: null, playerId: null,
    });

    route(ws, { type: "REJOIN_GAME", payload: { gameId: "game_1", playerToken: token } });

    const rejoined = frameOfType(ws, "GAME_REJOINED");
    expect(rejoined).toBeDefined();
    expect((rejoined!.payload.player as { characterName: string }).characterName).toBe("Ranulf");
    // The key property: no second character was created.
    expect(engine.getPlayerCount()).toBe(1);
    expect(engine.getConnectedPlayerCount()).toBe(1);
  });

  it("tells the client to start over when the token is unknown", () => {
    const ws = mockSocket();
    (manager as never as { clients: Map<unknown, unknown> }).clients.set(ws, {
      id: "conn_3", gameId: null, playerId: null,
    });

    route(ws, { type: "REJOIN_GAME", payload: { gameId: "game_1", playerToken: "not-a-real-token" } });

    expect(frameOfType(ws, "REJOIN_FAILED")).toBeDefined();
    expect(frameOfType(ws, "GAME_REJOINED")).toBeUndefined();
  });

  it("never puts a rejoin token into a broadcast payload", () => {
    const token = playerSessions.issue("game_1", "p1");
    engine.setPlayerConnected("p1", false);

    const rejoining = mockSocket();
    const bystander = mockSocket();
    const clients = (manager as never as { clients: Map<unknown, unknown> }).clients;
    clients.set(rejoining, { id: "conn_a", gameId: null, playerId: null });
    clients.set(bystander, { id: "conn_b", gameId: "game_1", playerId: "p2" });

    route(rejoining, { type: "REJOIN_GAME", payload: { gameId: "game_1", playerToken: token } });

    // Anyone who could read someone else's token could steal their seat.
    for (const frame of framesTo(bystander)) {
      expect(JSON.stringify(frame)).not.toContain(token);
    }
  });
});

describe("PlayerSessionRegistry", () => {
  beforeEach(() => playerSessions.clear());

  it("resolves a token back to its seat", () => {
    const token = playerSessions.issue("g1", "p1");
    expect(playerSessions.resolve(token)).toEqual({ gameId: "g1", playerId: "p1" });
  });

  it("issues distinct tokens for distinct seats", () => {
    expect(playerSessions.issue("g1", "p1")).not.toBe(playerSessions.issue("g1", "p2"));
  });

  it("retires the previous token when a seat is re-issued", () => {
    const first = playerSessions.issue("g1", "p1");
    const second = playerSessions.issue("g1", "p1");

    expect(playerSessions.resolve(first)).toBeUndefined();
    expect(playerSessions.resolve(second)).toBeDefined();
  });

  it("drops every token for a game that has been reaped", () => {
    const token = playerSessions.issue("g1", "p1");
    const other = playerSessions.issue("g2", "p1");

    playerSessions.releaseGame("g1");

    expect(playerSessions.resolve(token)).toBeUndefined();
    expect(playerSessions.resolve(other)).toBeDefined();
  });
});
