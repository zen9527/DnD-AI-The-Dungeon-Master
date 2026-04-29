import { WebSocket, WebSocketServer } from "ws";
import { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import type { MessageType, WebSocketMessage, Player, Attributes } from "../types/index.js";
import { gameStore } from "../game/store.js";
import { createGameSchema, joinGameSchema, playerActionSchema, chatMessageSchema } from "../../shared/index.js";

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, { id: string; gameId: string | null; playerId: string | null }>;
  private nextConnectionId: number;

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Map();
    this.nextConnectionId = 1;
    this.initialize();
  }

  private initialize(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const connectionId = `conn_${this.nextConnectionId++}`;
      this.clients.set(ws, { id: connectionId, gameId: null, playerId: null });

      console.log(`[WS] Client connected (${connectionId})`);

      ws.on("message", (data: Buffer) => {
        this.handleMessage(ws, data);
      });

      ws.on("close", () => {
        const client = this.clients.get(ws);
        console.log(`[WS] Client disconnected (${connectionId})`);
        if (client?.gameId) {
          gameStore.getGame(client.gameId)?.addChatMessage(client.playerId!, `${client.id} has disconnected`);
        }
        this.clients.delete(ws);
      });

      ws.on("error", (error: Error) => {
        console.error(`[WS] Error for ${connectionId}:`, error.message);
      });

      this.send(ws, "GAME_STATE", { message: "Connected to DnD server" });
    });
  }

  private handleMessage(ws: WebSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      this.routeMessage(ws, message);
    } catch {
      this.sendError(ws, "Invalid message format");
    }
  }

  private routeMessage(ws: WebSocket, message: WebSocketMessage): void {
    const client = this.clients.get(ws);
    const payload = message.payload as Record<string, unknown>;

    switch (message.type) {
      case "CREATE_GAME":
        this.handleCreateGame(ws, payload);
        break;
      case "JOIN_GAME":
        this.handleJoinGame(ws, client!, payload);
        break;
      case "LIST_GAMES":
        this.handleListGames(ws);
        break;
      case "PLAYER_ACTION":
        this.handlePlayerAction(ws, client!, payload);
        break;
      case "CHAT_MESSAGE":
        this.handleChatMessage(ws, client!, payload);
        break;
      case "DICE_ROLL":
        this.handleDiceRoll(ws, client!, payload);
        break;
      case "NPC_CREATE":
        this.handleNPCCreate(ws, client!, payload);
        break;
      case "EVENT_CREATE":
        this.handleEventCreate(ws, client!, payload);
        break;
      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  private handleCreateGame(ws: WebSocket, payload: Record<string, unknown>): void {
    const parsed = createGameSchema.safeParse(payload);
    if (!parsed.success) {
      this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
      return;
    }

    const p = parsed.data;
    const player: Player = {
      id: this.clients.get(ws)!.id,
      name: p.playerName,
      characterName: p.characterName,
      isDM: true,
      race: p.race,
      characterClass: p.characterClass,
      level: 1,
      attributes: p.attributes,
      hp: 10,
      maxHp: 10,
      ac: 11,
      proficiencyBonus: 2,
      spellSlots: {},
      inventory: [],
      conditions: [],
    };

    const scenario = (payload.scenario as string) || "dungeon";

    const engine = gameStore.createGame(
      (payload.gameName as string) || "New Adventure",
      (payload.maxPlayers as number) || 4,
      scenario,
      player
    );

    this.clients.set(ws, { id: this.clients.get(ws)!.id, gameId: engine.id, playerId: player.id });

    this.send(ws, "GAME_CREATED", { gameId: engine.id, game: engine.game });

    // Generate opening scene via LLM (delay + retry)
    this.send(ws, "STREAM_CHUNK", { content: "The Dungeon Master prepares the world...", isFinal: false });

    console.log(`[OpeningScene] Scheduling in 5s (game: ${engine.id})`);
    setTimeout(() => {
      console.log(`[OpeningScene] Attempting generation (game: ${engine.id})`);
      let attempt = 0;
      const tryGenerate = (): void => {
        attempt++;
        console.log(`[OpeningScene] Attempt ${attempt} (game: ${engine.id})`);
        engine.generateOpeningScene({
          onChunk: (chunk: string) => {
            this.broadcastToGame(engine!.id, "STREAM_CHUNK", { content: chunk, isFinal: false });
          },
          onEnd: (fullContent: string) => {
            this.broadcastToGame(engine!.id, "STREAM_END", {
              fullNarrative: fullContent,
              structured: engine!.game,
            });
          },
          onError: (error: Error) => {
            if (attempt < 4 && error.message.includes("ECONNREFUSED")) {
              console.log(`[OpeningScene] Attempt ${attempt} failed, retrying in 3s...`);
              setTimeout(() => tryGenerate(), 3000);
            } else {
              console.error(`[OpeningScene] Failed after ${attempt} attempts:`, error.message);
              this.broadcastToGame(engine!.id, "STREAM_ERROR", {
                message: error.message,
                fallbackNarrative: `The world forms around "${player.characterName}"... The adventure begins.`,
              });
            }
          },
        }).catch(console.error);
      };
      tryGenerate();
    }, 5000);
  }

  private handleJoinGame(ws: WebSocket, client: { id: string; gameId: string | null }, payload: Record<string, unknown>): void {
    const parsed = joinGameSchema.safeParse(payload);
    if (!parsed.success) {
      this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
      return;
    }

    const p = parsed.data;
    const engine = gameStore.getGame(p.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    const player: Player = {
      id: this.clients.get(ws)!.id,
      name: p.playerName,
      characterName: p.characterName,
      isDM: false,
      race: p.race,
      characterClass: p.characterClass,
      level: 1,
      attributes: p.attributes,
      hp: 10,
      maxHp: 10,
      ac: 11,
      proficiencyBonus: 2,
      spellSlots: {},
      inventory: [],
      conditions: [],
    };

    gameStore.joinGame(p.gameId, player);
    this.clients.set(ws, { id: this.clients.get(ws)!.id, gameId: engine.id, playerId: player.id });

    this.send(ws, "PLAYER_JOINED", {
      gameId: engine.id,
      player,
      gameState: engine.game,
    });

    this.broadcastToGame(engine.id, "PLAYER_JOINED", { player, gameState: engine.game }, ws);
  }

  private handleListGames(ws: WebSocket): void {
    this.send(ws, "GAME_STATE", { games: gameStore.listGames() });
  }

  private handlePlayerAction(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    const parsed = playerActionSchema.safeParse(payload);
    if (!parsed.success) {
      this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
      return;
    }

    const actionPayload = parsed.data;

    this.send(ws, "STREAM_CHUNK", { content: "The DM considers your action...", isFinal: false });

    engine.handlePlayerAction(actionPayload, client.playerId, {
      onChunk: (chunk: string) => {
        this.broadcastToGame(engine!.id, "STREAM_CHUNK", { content: chunk, isFinal: false });
      },
      onEnd: (fullContent: string) => {
        this.broadcastToGame(engine!.id, "STREAM_END", {
          fullNarrative: fullContent,
          structured: engine!.game,
        });
      },
      onError: (error: Error) => {
        this.broadcastToGame(engine!.id, "STREAM_ERROR", {
          message: error.message,
          fallbackNarrative: `You attempt: "${actionPayload.action}". The result is uncertain...`,
        });
      },
    });
  }

  private handleChatMessage(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }
    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    const parsed = chatMessageSchema.safeParse(payload);
    if (!parsed.success) {
      this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
      return;
    }

    engine.addChatMessage(client.playerId, parsed.data.content);
    this.broadcastToGame(engine.id, "CHAT_MESSAGE", { message: engine.game.chatHistory[engine.game.chatHistory.length - 1] });
  }

  private handleDiceRoll(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    // Server-side dice rolling prevents client manipulation
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }
    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player) {
      this.sendError(ws, "Player not found");
      return;
    }
    const diceType = (payload.diceType as number) || 20;
    const count = (payload.count as number) || 1;
    const modifier = (payload.modifier as number) || 0;
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * diceType) + 1);
    const total = rolls.reduce((s, r) => s + r, 0) + modifier;
    this.broadcastToGame(client.gameId, "DICE_ROLL_RESULT", {
      result: {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        playerId: client.playerId,
        playerName: player.name,
        characterName: player.characterName,
        diceType,
        count,
        rolls,
        modifier,
        total,
        timestamp: Date.now(),
      },
    });
  }

  private handleNPCCreate(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId) { this.sendError(ws, "Not in a game"); return; }
    const engine = gameStore.getGame(client.gameId);
    if (!engine) { this.sendError(ws, "Game not found"); return; }
    engine.addNPC(payload.name as string, (payload.description as string) || "", (payload.role as "friendly" | "neutral" | "hostile") || "neutral");
    this.broadcastToGame(engine.id, "NPC_CREATED", { npc: engine.game.npcs[engine.game.npcs.length - 1] });
  }

  private handleEventCreate(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId) { this.sendError(ws, "Not in a game"); return; }
    const engine = gameStore.getGame(client.gameId);
    if (!engine) { this.sendError(ws, "Game not found"); return; }
    engine.addEvent(payload.title as string, (payload.description as string) || "");
    this.broadcastToGame(engine.id, "EVENT_CREATED", { event: engine.game.chatHistory[engine.game.chatHistory.length - 1] });
  }

  send(ws: WebSocket, type: MessageType, payload: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }

  sendError(ws: WebSocket, errorMessage: string): void {
    this.send(ws, "ERROR", { message: errorMessage });
  }

  broadcastToGame(gameId: string, type: MessageType, payload: unknown, excludeWs?: WebSocket): void {
    this.clients.forEach((client, ws) => {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN && client.gameId === gameId) {
        this.send(ws, type, payload);
      }
    });
  }

  shutdown(): void {
    this.clients.forEach((_, ws) => ws.close());
    this.wss.close();
  }
}
