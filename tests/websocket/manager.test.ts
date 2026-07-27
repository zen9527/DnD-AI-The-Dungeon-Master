import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketServer } from "ws";
import { WebSocketManager } from "../../src/websocket/manager.js";
import { gameStore } from "../../src/game/store.js";
import type { Player, Game } from "../../src/types/index.js";

// Mock HTTP server for WebSocketManager
class MockHttpServer {
  listeners: Record<string, Function[]> = {};
  on(event: string, fn: Function) { this.listeners[event] = this.listeners[event] || []; this.listeners[event].push(fn); }
  emit(event: string, ...args: unknown[]) { (this.listeners[event] || []).forEach(fn => fn(...args)); }
}

describe("WebSocketManager emote handling", () => {
  let mockServer: MockHttpServer;
  let manager: WebSocketManager;
  let mockWs: any;

  beforeEach(() => {
    mockServer = new MockHttpServer() as any;
    manager = new WebSocketManager(mockServer as any);
    
    // Create mock WebSocket
    mockWs = {
      readyState: 1, // OPEN
      send: vi.fn(),
      close: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should broadcast EMOTE message to all players in game", async () => {
    // Setup mock client data
    const clientData = { id: "conn_1", gameId: "game_1", playerId: "player1" };
    (manager as any).clients.set(mockWs, clientData);

    // Mock game store with engine
    const mockPlayer: Player = {
      id: "player1",
      name: "TestPlayer",
      characterName: "TestCharacter",
      isDM: false,
      race: "Human",
      characterClass: "Fighter",
      level: 1,
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      hp: 10,
      maxHp: 10,
      ac: 11,
      proficiencyBonus: 2,
      spellSlots: {},
      spells: [],
      inventory: [],
      conditions: [],
      hitDice: { total: 1, used: 0 },
      deathSaves: { successes: 0, failures: 0 },
      xp: 0,
      locale: "en-US",
    };

    const mockGame: Game = {
      id: "game_1",
      name: "Test Game",
      maxPlayers: 4,
      scenario: "dungeon",
      players: [mockPlayer],
      npcs: [],
      chatHistory: [],
      conversationHistory: [],
      createdAt: Date.now(),
    };

    const mockEngine = {
      id: "game_1",
      game: mockGame,
      addChatMessage: vi.fn(),
    };

    vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

    // Send emote message
    const emoteMessage = {
      type: "PLAYER_EMOTE",
      payload: { action: "waves hello" },
    };

    manager["routeMessage"](mockWs, emoteMessage);

    // Verify broadcast was called with EMOTE_MESSAGE type
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining("EMOTE_MESSAGE")
    );
    
    // Verify the emote content is formatted correctly
    const sendCall = mockWs.send.mock.calls[0][0];
    const parsed = JSON.parse(sendCall);
    expect(parsed.payload.message.content).toBe("*TestCharacter waves hello*");
  });

  it("should handle emote with invalid action (empty string)", async () => {
    const clientData = { id: "conn_1", gameId: "game_1", playerId: "player1" };
    (manager as any).clients.set(mockWs, clientData);

    const emoteMessage = {
      type: "PLAYER_EMOTE",
      payload: { action: "" },
    };

    manager["routeMessage"](mockWs, emoteMessage);

    // Should send error
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining("ERROR")
    );
  });

  it("should handle emote when not in a game", async () => {
    const clientData = { id: "conn_1", gameId: null, playerId: null };
    (manager as any).clients.set(mockWs, clientData);

    const emoteMessage = {
      type: "PLAYER_EMOTE",
      payload: { action: "waves hello" },
    };

    manager["routeMessage"](mockWs, emoteMessage);

    // Should send error for not being in a game
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining("ERROR")
    );
  });

  it("should handle private chat to another player", async () => {
    const clientData = { id: "conn_1", gameId: "game_1", playerId: "player1" };
    (manager as any).clients.set(mockWs, clientData);

    const sender: Player = {
      id: "player1",
      name: "SenderPlayer",
      characterName: "SenderChar",
      isDM: false,
      race: "Human",
      characterClass: "Fighter",
      level: 1,
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      hp: 10,
      maxHp: 10,
      ac: 11,
      proficiencyBonus: 2,
      spellSlots: {},
      spells: [],
      inventory: [],
      conditions: [],
      hitDice: { total: 1, used: 0 },
      deathSaves: { successes: 0, failures: 0 },
      xp: 0,
      locale: "en-US",
    };

    const target: Player = {
      id: "player2",
      name: "TargetPlayer",
      characterName: "TargetChar",
      isDM: false,
      race: "Elf",
      characterClass: "Rogue",
      level: 1,
      attributes: { str: 8, dex: 16, con: 12, int: 14, wis: 10, cha: 10 },
      hp: 8,
      maxHp: 8,
      ac: 13,
      proficiencyBonus: 2,
      spellSlots: {},
      spells: [],
      inventory: [],
      conditions: [],
      hitDice: { total: 1, used: 0 },
      deathSaves: { successes: 0, failures: 0 },
      xp: 0,
      locale: "en-US",
    };

    const mockGame: Game = {
      id: "game_1",
      name: "Test Game",
      maxPlayers: 4,
      scenario: "dungeon",
      players: [sender, target],
      npcs: [],
      chatHistory: [],
      conversationHistory: [],
      createdAt: Date.now(),
    };

    const mockEngine = {
      id: "game_1",
      game: mockGame,
      addChatMessage: vi.fn(),
    };

    vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

    // Mock target player's WebSocket
    const targetWs = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
    };
    (manager as any).clients.set(targetWs, { id: "conn_2", gameId: "game_1", playerId: "player2" });

    const privateMessage = {
      type: "PRIVATE_CHAT",
      payload: {
        targetPlayerId: "player2",
        content: "Secret message",
      },
    };

    manager["routeMessage"](mockWs, privateMessage);

    // Verify sender receives PRIVATE_MESSAGE
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining("PRIVATE_MESSAGE")
    );

    // Verify target receives PRIVATE_MESSAGE
    expect(targetWs.send).toHaveBeenCalledWith(
      expect.stringContaining("PRIVATE_MESSAGE")
    );
  });
});
