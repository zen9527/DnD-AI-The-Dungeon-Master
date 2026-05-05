import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketManager } from "../../src/websocket/manager.js";
import { gameStore } from "../../src/game/store.js";
import { saveGameSchema } from "../../shared/index.js";

// Mock HTTP server for WebSocketManager
class MockHttpServer {
  listeners: Record<string, Function[]> = {};
  on(event: string, fn: Function) { this.listeners[event] = this.listeners[event] || []; this.listeners[event].push(fn); }
  emit(event: string, ...args: unknown[]) { (this.listeners[event] || []).forEach(fn => fn(...args)); }
}

describe("saveGameSchema", () => {
  it("should validate valid game ID", () => {
    const result = saveGameSchema.safeParse({ gameId: "game_123" });
    expect(result.success).toBe(true);
  });

  it("should reject empty game ID", () => {
    const result = saveGameSchema.safeParse({ gameId: "" });
    expect(result.success).toBe(false);
  });

  it("should reject missing gameId", () => {
    const result = saveGameSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("WebSocketManager - SAVE_GAME", () => {
  let mockServer: MockHttpServer;
  let manager: WebSocketManager;
  let mockWs: any;

  beforeEach(() => {
    mockServer = new MockHttpServer() as any;
    manager = new WebSocketManager(mockServer as any);
    
    mockWs = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should handle SAVE_GAME message and broadcast GAME_SAVED", () => {
    const gameId = "test_game_123";
    
    // Setup client data
    const clientData = { id: "conn_1", gameId, playerId: "player_1" };
    (manager as any).clients.set(mockWs, clientData);
    
    // Mock game exists in store with saveGame method
    const mockEngine = {
      id: gameId,
      game: { id: gameId, name: "Test Game" },
      saveGame: vi.fn(),
    };
    vi.spyOn(gameStore, "getGame").mockReturnValue(mockEngine as any);

    // Send SAVE_GAME message
    const message = {
      type: "SAVE_GAME",
      payload: { gameId },
    };

    (manager as any).routeMessage(mockWs, message);

    // Verify GAME_SAVED broadcast
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining("GAME_SAVED")
    );
  });

  it("should reject SAVE_GAME if client is not in the game", () => {
    const gameId = "test_game_123";
    const clientData = { id: "conn_1", gameId: "other_game", playerId: "player_1" };
    (manager as any).clients.set(mockWs, clientData);
    
    const message = {
      type: "SAVE_GAME",
      payload: { gameId },
    };

    (manager as any).routeMessage(mockWs, message);

    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining("You are not in this game")
    );
  });

  it("should reject SAVE_GAME if game not found", () => {
    const gameId = "test_game_123";
    const clientData = { id: "conn_1", gameId, playerId: "player_1" };
    (manager as any).clients.set(mockWs, clientData);
    
    vi.spyOn(gameStore, "getGame").mockReturnValue(null);

    const message = {
      type: "SAVE_GAME",
      payload: { gameId },
    };

    (manager as any).routeMessage(mockWs, message);

    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining("Game not found")
    );
  });

  it("should reject SAVE_GAME with invalid payload", () => {
    const clientData = { id: "conn_1", gameId: "test_game", playerId: "player_1" };
    (manager as any).clients.set(mockWs, clientData);
    
    const message = {
      type: "SAVE_GAME",
      payload: {},
    };

    (manager as any).routeMessage(mockWs, message);

    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining("Required")
    );
  });
});
