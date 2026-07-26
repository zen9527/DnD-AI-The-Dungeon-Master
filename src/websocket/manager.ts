import { WebSocket, WebSocketServer } from "ws";
import { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import type { MessageType, WebSocketMessage } from "../types/index.js";
import { gameStore } from "../game/store.js";
import { messageHandlers } from "./handlers/index.js";
import type { HandlerContext, ManagerApi, WebSocketClient } from "./types.js";
import { LLMRateLimiter } from "./rate-limit.js";

/** How often the server pushes the turn countdown to clients. */
const TIMER_BROADCAST_INTERVAL_MS = 1000;

/**
 * Owns the WebSocket server: connection lifecycle, message routing, broadcast
 * primitives, and per-game timer broadcasts. All message-specific logic lives
 * in `./handlers/*` and reaches back through the `ManagerApi` interface.
 */
export class WebSocketManager implements ManagerApi {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, WebSocketClient>;
  private nextConnectionId: number;
  private timerBroadcastIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly llmRateLimiter = new LLMRateLimiter();

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Map();
    this.nextConnectionId = 1;
    this.initialize();
  }

  private initialize(): void {
    this.wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
      const connectionId = `conn_${this.nextConnectionId++}`;
      this.clients.set(ws, { id: connectionId, gameId: null, playerId: null });

      console.log(`[WS] Client connected (${connectionId})`);

      ws.on("message", (data: Buffer) => this.handleMessage(ws, data));
      ws.on("close", () => this.handleClose(ws, connectionId));
      ws.on("error", (error: Error) => {
        console.error(`[WS] Error for ${connectionId}:`, error.message);
      });

      this.send(ws, "GAME_CONNECTED", {});
    });
  }

  private handleClose(ws: WebSocket, connectionId: string): void {
    const client = this.clients.get(ws);
    console.log(`[WS] Client disconnected (${connectionId})`);

    if (client?.gameId && client?.playerId) {
      const engine = gameStore.getGame(client.gameId);
      if (engine) {
        // Keep the seat. A refresh is a disconnect, and deleting the player
        // here is what used to destroy characters on reload — the seat is
        // reclaimed by REJOIN_GAME, or reaped by the empty-game cleanup.
        engine.setPlayerConnected(client.playerId, false);
        this.broadcastToGame(client.gameId, "PLAYER_LEFT", {
          playerId: client.playerId,
          gameState: engine.game,
        });
      }
    }
    this.llmRateLimiter.forget(connectionId);
    this.clients.delete(ws);
  }

  private handleMessage(ws: WebSocket, data: Buffer): void {
    const rawStr = data.toString();

    try {
      const message = JSON.parse(rawStr) as WebSocketMessage;
      this.routeMessage(ws, message);
    } catch (error) {
      console.error(`[WS] handleMessage error for "${rawStr}":`, error instanceof Error ? error.message : "unknown");
      this.sendError(ws, `Invalid message format: ${error instanceof Error ? error.message : "parse failed"}`);
    }
  }

  private routeMessage(ws: WebSocket, message: WebSocketMessage): void {
    const handler = messageHandlers[message.type];
    if (!handler) {
      this.sendError(ws, `Unknown message type: ${message.type}`);
      return;
    }

    const client = this.clients.get(ws);
    if (!client) {
      this.sendError(ws, "Connection not registered");
      return;
    }

    // Anyone with the game link can send these, and each one costs LLM tokens.
    if (!this.llmRateLimiter.tryConsume(client.id, message.type)) {
      const retryAfter = this.llmRateLimiter.retryAfterSeconds(client.id);
      console.warn(`[WS] Rate limited ${message.type} from ${client.id}`);
      this.sendError(ws, `Too many requests — wait ${retryAfter}s before trying again.`);
      return;
    }

    const ctx: HandlerContext = {
      ws,
      client,
      payload: (message.payload ?? {}) as Record<string, unknown>,
      manager: this,
    };

    // Handlers may be async (LLM streaming); a rejection must not kill the socket.
    Promise.resolve(handler(ctx)).catch(error => {
      console.error(`[WS] Handler for ${message.type} failed:`, error instanceof Error ? error.message : error);
    });
  }

  // ---- ManagerApi ----

  send(ws: WebSocket, type: MessageType, payload: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }

  sendError(ws: WebSocket, errorMessage: string): void {
    this.send(ws, "ERROR", { message: errorMessage });
  }

  /**
   * Send one message to everyone in a game.
   *
   * Most broadcasts carry the whole game state, which is ~170 KB in a long
   * campaign. Serializing once and reusing the string is measurably cheaper
   * than letting `send` re-encode it per socket (1.49 ms -> 0.34 ms at four
   * clients), and the saving grows with the size of the table.
   */
  broadcastToGame(gameId: string, type: MessageType, payload: unknown, excludeWs?: WebSocket): void {
    let frame: string | null = null;

    this.clients.forEach((client, ws) => {
      if (ws === excludeWs || ws.readyState !== WebSocket.OPEN || client.gameId !== gameId) return;

      frame ??= JSON.stringify({ type, payload });
      ws.send(frame);
    });
  }

  findPlayerSocket(playerId: string): WebSocket | undefined {
    for (const [ws, client] of this.clients) {
      if (client.playerId === playerId) return ws;
    }
    return undefined;
  }

  attachClient(ws: WebSocket, client: WebSocketClient): void {
    this.clients.set(ws, client);
  }

  /**
   * Push the turn countdown to every client in a game once a second, so the
   * displayed timer stays in step with the engine's authoritative clock.
   */
  startTimerBroadcast(gameId: string): void {
    const existing = this.timerBroadcastIntervals.get(gameId);
    if (existing) clearInterval(existing);

    if (!gameStore.getGame(gameId)) return;

    const interval = setInterval(() => {
      const engine = gameStore.getGame(gameId);
      if (!engine) {
        clearInterval(interval);
        this.timerBroadcastIntervals.delete(gameId);
        return;
      }

      const currentPlayer = engine.getCurrentPlayer();
      if (!currentPlayer) return;

      // A countdown that reaches zero and does nothing is just a nagging
      // clock, so expiry hands the turn on. advanceTurn() restarts the
      // timer, which clears `expired` and stops this from firing twice.
      if (engine.timerExpired) {
        console.log(`[Timer] ${currentPlayer.characterName} ran out of time — advancing the turn`);
        this.broadcastToGame(gameId, "TURN_TIMER", {
          remaining: 0,
          currentPlayerId: currentPlayer.id,
          characterName: currentPlayer.characterName,
          expired: true,
        });

        engine.advanceTurn();
        this.broadcastToGame(gameId, "COMBAT_STATE", {
          combatMode: engine.combatMode,
          initiativeOrder: engine.initiativeOrder,
          currentRound: engine.currentRound,
          currentTurnIndex: engine.currentTurnIndex,
          currentPlayerName: engine.getCurrentPlayer()?.characterName,
        });
        return;
      }

      this.broadcastToGame(gameId, "TURN_TIMER", {
        remaining: engine.timerRemaining,
        currentPlayerId: currentPlayer.id,
        characterName: currentPlayer.characterName,
        expired: false,
      });
    }, TIMER_BROADCAST_INTERVAL_MS);

    this.timerBroadcastIntervals.set(gameId, interval);
  }

  shutdown(): void {
    for (const interval of this.timerBroadcastIntervals.values()) {
      clearInterval(interval);
    }
    this.timerBroadcastIntervals.clear();

    this.clients.forEach((_, ws) => ws.close());
    this.wss.close();
  }
}
