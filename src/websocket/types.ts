import type { WebSocket } from "ws";
import type { MessageType } from "../types/index.js";

/** Per-connection bookkeeping tracked by the WebSocketManager. */
export interface WebSocketClient {
  id: string;
  gameId: string | null;
  playerId: string | null;
}

/**
 * The slice of the WebSocketManager that handler modules are allowed to use.
 * Keeping this narrow stops handlers from reaching into connection internals.
 */
export interface ManagerApi {
  send(ws: WebSocket, type: MessageType, payload: unknown): void;
  sendError(ws: WebSocket, errorMessage: string): void;
  broadcastToGame(gameId: string, type: MessageType, payload: unknown, excludeWs?: WebSocket): void;
  startTimerBroadcast(gameId: string): void;
  /** Find the socket belonging to a player in any game, if still connected. */
  findPlayerSocket(playerId: string): WebSocket | undefined;
  /** Re-bind a socket to a game/player after create or join. */
  attachClient(ws: WebSocket, client: WebSocketClient): void;
}

/** Everything a handler needs for one inbound message. */
export interface HandlerContext {
  ws: WebSocket;
  client: WebSocketClient;
  payload: Record<string, unknown>;
  manager: ManagerApi;
}

export type MessageHandler = (ctx: HandlerContext) => void | Promise<void>;

/** A handler module contributes a slice of the message-type -> handler registry. */
export type HandlerRegistry = Partial<Record<MessageType, MessageHandler>>;
