import { WebSocket } from "ws";
import { Server as HttpServer } from "http";
import type { MessageType } from "../types/index.js";
export declare class WebSocketManager {
    private wss;
    private clients;
    private nextConnectionId;
    constructor(server: HttpServer);
    private initialize;
    private handleMessage;
    private routeMessage;
    private handleCreateGame;
    private handleJoinGame;
    private handleListGames;
    private handlePlayerAction;
    private handleChatMessage;
    private handleSetLocale;
    private handleDiceRoll;
    private handleNPCCreate;
    private handleEventCreate;
    send(ws: WebSocket, type: MessageType, payload: unknown): void;
    sendError(ws: WebSocket, errorMessage: string): void;
    broadcastToGame(gameId: string, type: MessageType, payload: unknown, excludeWs?: WebSocket): void;
    shutdown(): void;
}
//# sourceMappingURL=manager.d.ts.map