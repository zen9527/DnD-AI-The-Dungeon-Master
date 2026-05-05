import { WebSocket, WebSocketServer } from "ws";
import { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import type { MessageType, WebSocketMessage, Player, Attributes, ChatMessage } from "../types/index.js";
import { gameStore } from "../game/store.js";
import type { GameEngine } from "../game/engine.js";
import { buildSystemPrompt } from "../llm/prompts.js";
import { type Scenario } from "../../shared/schemas/scenario.js";
import { getLocalizedMessage } from "../utils/locale-loader.js";
import { z } from "zod";
import { generateId } from "../utils/id.js";

// Hit dice by class (D&D 5e standard)
function getHitDiceForClass(characterClass: string): number {
  const hdMap: Record<string, number> = {
    Barbarian: 4, Fighter: 3, Paladin: 3, Ranger: 3,
    Cleric: 2, Druid: 2, Monk: 2, Rogue: 2,
    Sorcerer: 1, Warlock: 1, Wizard: 1, Bard: 1,
  };
  return hdMap[characterClass] || 1;
}
import { createGameSchema, joinGameSchema, playerActionSchema, chatMessageSchema, emoteSchema, privateChatSchema, combatStartSchema, combatEndSchema, initiativeRollSchema, turnAdvanceSchema } from "../../shared/index.js";

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, { id: string; gameId: string | null; playerId: string | null }>;
  private nextConnectionId: number;
  private timerBroadcastIntervals: Map<string, NodeJS.Timeout> = new Map(); // Per-game timer broadcast

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

      this.send(ws, "GAME_CONNECTED", {});
    });
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
      case "PLAYER_EMOTE":
        this.handleEmote(ws, client!, payload);
        break;
      case "PRIVATE_CHAT":
        this.handlePrivateChat(ws, client!, payload);
        break;
      case "SET_LOCALE":
        this.handleSetLocale(ws, client!, payload);
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
      case "COMBAT_START":
        this.handleCombatStart(ws, client!, payload);
        break;
      case "COMBAT_END":
        this.handleCombatEnd(ws, client!, payload);
        break;
      case "INITIATIVE_ROLL":
        this.handleInitiativeRoll(ws, client!, payload);
        break;
      case "TURN_ADVANCE":
        this.handleTurnAdvance(ws, client!, payload);
        break;
      // DM Control handlers
      case "NPC_UPDATE_HP":
        this.handleNPCUpdateHP(ws, client!, payload);
        break;
      case "NPC_APPLY_CONDITION":
        this.handleNPCApplyCondition(ws, client!, payload);
        break;
      case "NPC_REMOVE_CONDITION":
        this.handleNPCRemoveCondition(ws, client!, payload);
        break;
      case "NPC_DELETE":
        this.handleNPCDelete(ws, client!, payload);
        break;
      case "PLAYER_AWARD_XP":
        this.handlePlayerAwardXP(ws, client!, payload);
        break;
      case "PLAYER_LEVEL_UP":
        this.handlePlayerLevelUp(ws, client!, payload);
        break;
      // Inventory & Equipment handlers
      case "INVENTORY_ADD_ITEM":
        this.handleInventoryAddItem(ws, client!, payload);
        break;
      case "EQUIP_WEAPON":
        this.handleEquipWeapon(ws, client!, payload);
        break;
      case "EQUIP_ARMOR":
        this.handleEquipArmor(ws, client!, payload);
        break;
      case "UNEQUIP_WEAPON":
        this.handleUnequipWeapon(ws, client!, payload);
        break;
      case "UNEQUIP_ARMOR":
        this.handleUnequipArmor(ws, client!, payload);
        break;
      case "USE_ITEM":
        this.handleUseItem(ws, client!, payload);
        break;
      case "APPLY_TEMPORARY_HP":
        this.handleApplyTemporaryHP(ws, client!, payload);
        break;
      case "APPLY_BUFF":
        this.handleApplyBuff(ws, client!, payload);
        break;
      case "REMOVE_BUFF":
        this.handleRemoveBuff(ws, client!, payload);
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
    const clientData = this.clients.get(ws)!;

    const player: Player = {
      id: clientData.id,
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
      spells: [],
      inventory: [],
      equippedWeapon: undefined,
      equippedArmor: undefined,
      usedItems: [],
      conditions: [],
      buffs: [],
      hitDice: { total: getHitDiceForClass(p.characterClass), used: 0 },
      deathSaves: { successes: 0, failures: 0 },
      xp: 0,
      locale: (payload.locale as string) || "en-US",
    };

    const scenario = (payload.scenario as string) || "dungeon";
    const locale = (payload.locale as string) || "en-US";

    const engine = gameStore.createGame(
      (payload.gameName as string) || "New Adventure",
      (payload.maxPlayers as number) || 4,
      scenario,
      player
    );

    this.clients.set(ws, { id: clientData.id, gameId: engine.id, playerId: player.id });

    this.send(ws, "GAME_CREATED", { gameId: engine.id, game: engine.game });

    // Generate opening scene via LLM (delay + retry)
    this.send(ws, "STREAM_CHUNK", { content: getLocalizedMessage(locale, "status.dm_preparing"), isFinal: false });

    setTimeout(() => {
      console.log(`[OpeningScene] Attempting generation (game: ${engine.id})`);
      let attempt = 0;

      const tryGenerate = async (): Promise<void> => {
        attempt++;
        console.log(`[OpeningScene] Attempt ${attempt} (game: ${engine.id})`);

        try {
          // Pass only onChunk and onError to engine - handle onEnd manually AFTER await
          const parsed = await engine.generateOpeningScene({
            onChunk: (chunk: string) => {
              this.broadcastToGame(engine!.id, "STREAM_CHUNK", { content: chunk, isFinal: false });
            },
            onEnd: () => {
              // Don't use - we'll broadcast after state updates complete
            },
            onError: (error: Error) => {
              const isConnectionError = error.message.includes("unreachable") || error.message.includes("ECONNREFUSED");
              const isTimeout = error.message.includes("timed out") || error.message.includes("idle timeout");

              if (attempt < 4 && (isConnectionError || isTimeout)) {
                console.log(`[OpeningScene] Attempt ${attempt} failed (${isTimeout ? "timeout" : "connection"}), retrying in 3s...`);
                setTimeout(() => tryGenerate(), 3000);
              } else {
                console.error(`[OpeningScene] Failed after ${attempt} attempts:`, error.message);
                const fallback = `The world forms around "${player.characterName}"... The adventure begins.`;
                // Persist fallback narrative to chatHistory so it survives page refresh
                engine.addEvent("DM", fallback);
                this.broadcastToGame(engine!.id, "STREAM_ERROR", {
                  message: error.message,
                  fallbackNarrative: fallback,
                });
              }
            },
          });

          // AFTER await completes - engine method has updated chatHistory
          console.log(`[OpeningScene] Generation complete (game: ${engine.id})`);
          
          // Broadcast the new DM narrative as a chat message FIRST
          const latestMessage = engine.game.chatHistory[engine.game.chatHistory.length - 1];
          if (latestMessage) {
            this.broadcastToGame(engine.id, "CHAT_MESSAGE", {
              message: latestMessage,
              gameState: engine.game,
            });
          }
          
          this.broadcastToGame(engine.id, "STREAM_END", {
            fullNarrative: parsed.fullNarrative,
            structured: engine.game,  // Public getter returns a fresh snapshot
          });

          // Start timer for the DM after opening scene
          const dmPlayer = engine.game.players.find(p => p.isDM);
          if (dmPlayer) {
            engine.startTimer();
            this.broadcastToGame(engine.id, "TURN_TIMER", {
              remaining: engine.timerRemaining,
              currentPlayerId: dmPlayer.id,
              characterName: dmPlayer.characterName,
            });
            
            // Start periodic timer broadcast (every 5 seconds)
            this.startTimerBroadcast(engine.id);
          }

        } catch (error) {
          if (!(error instanceof Error && error.message.includes("Failed after"))) {
            console.error(`[OpeningScene] Unexpected error:`, error instanceof Error ? error.message : error);
            const fallback = `The world forms around "${player.characterName}"... The adventure begins.`;
            engine.addEvent("DM", fallback);
            this.broadcastToGame(engine.id, "STREAM_ERROR", {
              message: error instanceof Error ? error.message : "Unknown error",
              fallbackNarrative: fallback,
            });
          }
        }
      };

      tryGenerate().catch((err) => {
        console.error(`[OpeningScene] Unhandled rejection:`, err instanceof Error ? err.message : err);
      });
    }, 5000);
  }

  private handleJoinGame(ws: WebSocket, client: { id: string; gameId: string | null }, payload: Record<string, unknown>): void {
    const parsed = joinGameSchema.safeParse(payload);
    if (!parsed.success) {
      this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
      return;
    }

    const p = parsed.data;
    let engine: GameEngine | null = gameStore.getGame(p.gameId) ?? null;
    
    // If game not in memory, try loading from disk (saved games from lobby)
    if (!engine) {
      engine = gameStore.loadSingleGame(p.gameId);
      if (!engine) {
        this.sendError(ws, "Game not found");
        return;
      }
      console.log(`[WebSocket] Loaded saved game ${p.gameId} from disk`);
    }
    
    // At this point, engine is guaranteed to be defined (we returned early if not)
    const currentEngine = engine!;

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
      spells: [],
      inventory: [],
      equippedWeapon: undefined,
      equippedArmor: undefined,
      usedItems: [],
      conditions: [],
      buffs: [],
      hitDice: { total: getHitDiceForClass(p.characterClass), used: 0 },
      deathSaves: { successes: 0, failures: 0 },
      xp: 0,
      locale: (payload.locale as string) || "en-US",
    };

    gameStore.joinGame(p.gameId, player);
    this.clients.set(ws, { id: this.clients.get(ws)!.id, gameId: currentEngine.id, playerId: player.id });

    // Send join notification to all players
    const joinLocale = player.locale || "en-US";
    const joinMsg = getLocalizedMessage(joinLocale, "player_joined.notification").replace("{name}", player.characterName);
    currentEngine.addEvent("Player Joined", `${player.characterName} has joined the adventure`);
    this.broadcastToGame(currentEngine.id, "CHAT_MESSAGE", {
      message: currentEngine.game.chatHistory[currentEngine.game.chatHistory.length - 1],
      gameState: currentEngine.game,
    });

    // Send game state to the joining player
    this.send(ws, "PLAYER_JOINED", {
      gameId: currentEngine.id,
      player,
      gameState: currentEngine.game,
    });

    // Broadcast updated state to other players (excluding the joining player)
    this.broadcastToGame(currentEngine.id, "PLAYER_JOINED", { player, gameState: currentEngine.game }, ws);

    // If this is the first player joining (DM already in game), generate a welcome scene from DM
    if (currentEngine.game.players.length > 1 && currentEngine.game.chatHistory.length <= 1) {
      // DM is already in the game but no opening scene yet — generate one for the new player
      const dmPlayer = currentEngine.game.players.find(pl => pl.isDM);
      if (dmPlayer) {
        this.send(ws, "STREAM_CHUNK", { content: getLocalizedMessage(joinLocale, "status.dm_preparing"), isFinal: false });
        setTimeout(() => {
          currentEngine.generateOpeningScene({
            onChunk: (chunk: string) => {
              this.broadcastToGame(currentEngine.id, "STREAM_CHUNK", { content: chunk, isFinal: false });
            },
            onEnd: () => {},
            onError: (error: Error) => {
              const fallback = `The world forms around "${player.characterName}"... The adventure begins.`;
              currentEngine.addEvent("DM", fallback);
              this.broadcastToGame(currentEngine.id, "STREAM_ERROR", {
                message: error.message,
                fallbackNarrative: fallback,
              });
            },
          }).then((result) => {
            this.broadcastToGame(currentEngine.id, "STREAM_END", {
              fullNarrative: result.fullNarrative,
              structured: currentEngine.game,
            });
          }).catch(() => {});
        }, 2000);
      }
    }
  }

  private handleListGames(ws: WebSocket): void {
    this.send(ws, "GAME_STATE", { games: gameStore.listGames() });
  }

  private async handlePlayerAction(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): Promise<void> {
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

    // Add player's action to chat history immediately (so it shows before DM response)
    engine.addChatMessage(client.playerId, actionPayload.action);
    this.broadcastToGame(engine.id, "CHAT_MESSAGE", {
      message: engine.game.chatHistory[engine.game.chatHistory.length - 1],
      gameState: engine.game
    });

    const playerAction = engine.game.players.find(p => p.id === client.playerId);
    const actionLocale = playerAction?.locale || "en-US";
    this.send(ws, "STREAM_CHUNK", { content: getLocalizedMessage(actionLocale, "status.dm_considers"), isFinal: false });

    // Await complete generation then broadcast with updated state
    try {
      const parsed = await engine.handlePlayerAction(actionPayload, client.playerId, {
        onChunk: (chunk: string) => {
          this.broadcastToGame(engine!.id, "STREAM_CHUNK", { content: chunk, isFinal: false });
        },
        onEnd: () => {
          // Don't use this - we'll broadcast after state updates complete
        },
        onError: (error: Error) => {
          const fallback = `You attempt: "${actionPayload.action}". The result is uncertain...`;
          engine.addEvent("DM", fallback);
          this.broadcastToGame(engine!.id, "STREAM_ERROR", {
            message: error.message,
            fallbackNarrative: fallback,
          });
        },
      });

      // AFTER await completes - engine method has updated chatHistory with DM response
      console.log(`[DM Response] Complete for player ${client.playerId}`);
      
      // Broadcast the new DM narrative as a chat message FIRST
      const latestMessage = engine.game.chatHistory[engine.game.chatHistory.length - 1];
      if (latestMessage && latestMessage.type === "narrative") {
        this.broadcastToGame(engine.id, "CHAT_MESSAGE", {
          message: latestMessage,
          gameState: engine.game,
        });
      }
      
      this.broadcastToGame(engine.id, "STREAM_END", {
        fullNarrative: parsed.fullNarrative,
        structured: engine.game,  // Public getter returns fresh snapshot after state update
      });

      // Start timer for the new current player (advanceTurn already called in engine)
      const currentPlayer = engine.getCurrentPlayer();
      if (currentPlayer) {
        this.broadcastToGame(engine.id, "TURN_TIMER", {
          remaining: engine.timerRemaining,
          currentPlayerId: currentPlayer.id,
          characterName: currentPlayer.characterName,
          expired: engine.timerExpired,
        });
        
        // Restart periodic timer broadcast for new turn
        this.startTimerBroadcast(engine.id);
      }

    } catch (error) {
      if (!(error instanceof Error && error.message.includes("You attempt"))) {
        console.error(`[DM Response] Unexpected error for player ${client.playerId}:`, error);
      }
    }
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
    this.broadcastToGame(engine.id, "CHAT_MESSAGE", {
      message: engine.game.chatHistory[engine.game.chatHistory.length - 1],
      gameState: engine.game  // Send full game state to ensure consistency
    });
  }

  private handleEmote(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Validate emote action
    const parsed = emoteSchema.safeParse(payload);
    if (!parsed.success) {
      this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
      return;
    }

    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player) {
      this.sendError(ws, "Player not found");
      return;
    }

    // Format emote as "*PlayerName action*"
    const emoteContent = `*${player.characterName || player.name} ${parsed.data.action}*`;
    
    const emoteMsg: ChatMessage = {
      id: generateId(),
      playerId: client.playerId,
      playerName: player.name,
      characterName: player.characterName,
      content: emoteContent,
      type: "emote",
      timestamp: Date.now(),
    };

    engine.addChatMessage(client.playerId, emoteContent);
    this.broadcastToGame(engine.id, "EMOTE_MESSAGE", {
      message: emoteMsg,
      gameState: engine.game
    });
  }

  private handlePrivateChat(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Validate private chat payload
    const parsed = privateChatSchema.safeParse(payload);
    if (!parsed.success) {
      this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
      return;
    }

    const sender = engine.game.players.find(p => p.id === client.playerId);
    const target = engine.game.players.find(p => p.id === parsed.data.targetPlayerId);
    
    if (!sender) {
      this.sendError(ws, "Sender not found");
      return;
    }
    if (!target) {
      this.sendError(ws, "Target player not found");
      return;
    }

    const privateMsg: ChatMessage = {
      id: generateId(),
      playerId: client.playerId,
      playerName: sender.name,
      characterName: sender.characterName,
      content: getLocalizedMessage(target.locale || "en-US", "private_chat.prefix")
        .replace("{targetName}", target.characterName || target.name)
        .replace("{content}", parsed.data.content),
      type: "text",
      timestamp: Date.now(),
    };

    // Send to sender (confirmation)
    this.send(ws, "PRIVATE_MESSAGE", {
      message: privateMsg,
      targetPlayerId: parsed.data.targetPlayerId
    });

    // Send to target (only they can see it)
    const targetWs = Array.from(this.clients.entries()).find(
      ([ws, client]) => client.playerId === parsed.data.targetPlayerId
    )?.[0];
    if (targetWs) {
      this.send(targetWs, "PRIVATE_MESSAGE", {
        message: privateMsg,
        senderPlayerId: client.playerId
      });
    }
  }

  private handleSetLocale(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
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

    const newLocale = (payload.locale as string) || "en-US";
    player.locale = newLocale;

    // Update system prompt in conversation history with new locale
    const scenario = (engine.game.scenario as Scenario) || "dungeon";
    if (engine.game.conversationHistory.length > 0) {
      engine.game.conversationHistory[0] = {
        role: "system",
        content: buildSystemPrompt(scenario, newLocale),
      };
    }

    this.send(ws, "LOCALE_UPDATED", { locale: newLocale });
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

  /**
   * Start periodic timer broadcast for a game (every second for smooth display)
   */
  startTimerBroadcast(gameId: string): void {
    // Clear existing interval if any
    const existing = this.timerBroadcastIntervals.get(gameId);
    if (existing) {
      clearInterval(existing);
    }
    
    const engine = gameStore.getGame(gameId);
    if (!engine) return;
    
    // Broadcast timer state every 1 second for smooth countdown display
    const interval = setInterval(() => {
      const currentEngine = gameStore.getGame(gameId);
      if (!currentEngine) {
        clearInterval(interval);
        this.timerBroadcastIntervals.delete(gameId);
        return;
      }
      
      const currentPlayer = currentEngine.getCurrentPlayer();
      if (currentPlayer) {
        this.broadcastToGame(gameId, "TURN_TIMER", {
          remaining: currentEngine.timerRemaining,
          currentPlayerId: currentPlayer.id,
          characterName: currentPlayer.characterName,
          expired: currentEngine.timerExpired,
        });
      }
    }, 1000); // Changed from 5000 to 1000 for smoother display
    
    this.timerBroadcastIntervals.set(gameId, interval);
  }

  // ---- Combat Handlers ----

  private handleCombatStart(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const parsed = combatStartSchema.safeParse(payload);
    if (!parsed.success) {
      this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Only DM can start combat
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player?.isDM) {
      this.sendError(ws, "Only the DM can start combat");
      return;
    }

    engine.startCombat(parsed.data.startInitiative ?? true);

    // Broadcast combat state to all players
    this.broadcastToGame(client.gameId, "COMBAT_STATE", {
      combatMode: true,
      initiativeOrder: engine.initiativeOrder,
      currentRound: engine.currentRound,
      currentTurnIndex: engine.currentTurnIndex,
      currentPlayerName: engine.getCurrentPlayer()?.characterName,
    });

    console.log(`[Combat] Combat started in game ${client.gameId}`);
  }

  private handleCombatEnd(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Only DM can end combat
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player?.isDM) {
      this.sendError(ws, "Only the DM can end combat");
      return;
    }

    engine.endCombat();

    // Broadcast combat state to all players
    this.broadcastToGame(client.gameId, "COMBAT_STATE", {
      combatMode: false,
      initiativeOrder: [],
      currentRound: 1,
      currentTurnIndex: 0,
      currentPlayerName: undefined,
    });

    console.log(`[Combat] Combat ended in game ${client.gameId}`);
  }

  private handleInitiativeRoll(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const parsed = initiativeRollSchema.safeParse(payload);
    if (!parsed.success) {
      this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Only DM can roll initiative for others
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player?.isDM) {
      this.sendError(ws, "Only the DM can roll initiative");
      return;
    }

    const score = engine.rollIndividualInitiative(parsed.data.entityId, parsed.data.isPlayer);

    // Broadcast updated initiative order
    this.broadcastToGame(client.gameId, "INITIATIVE_UPDATE", {
      initiativeOrder: engine.initiativeOrder,
      newEntry: { entityId: parsed.data.entityId, score },
    });

    console.log(`[Initiative] ${parsed.data.isPlayer ? "Player" : "NPC"} ${parsed.data.entityId} rolled ${score}`);
  }

  private handleTurnAdvance(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Only DM can manually advance turns
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player?.isDM) {
      this.sendError(ws, "Only the DM can advance turns");
      return;
    }

    engine.advanceTurn();

    // Broadcast updated combat state
    this.broadcastToGame(client.gameId, "COMBAT_STATE", {
      combatMode: engine.combatMode,
      initiativeOrder: engine.initiativeOrder,
      currentRound: engine.currentRound,
      currentTurnIndex: engine.currentTurnIndex,
      currentPlayerName: engine.getCurrentPlayer()?.characterName,
    });

    console.log(`[Combat] Turn advanced in game ${client.gameId}`);
  }

  // ---- DM Control Handlers ----

  private handleNPCUpdateHP(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Only DM can update NPC HP
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player?.isDM) {
      this.sendError(ws, "Only the DM can update NPC HP");
      return;
    }

    const npcId = payload.npcId as string;
    const newHp = payload.newHp as number;

    engine.updateNPCHP(npcId, newHp);

    // Broadcast updated state to all players
    this.broadcastToGame(client.gameId, "DM_CONTROL_UPDATE", {
      action: "npc_update_hp",
      npcId,
      newHp,
      gameState: engine.game,
    });

    console.log(`[DM Control] Updated NPC ${npcId} HP to ${newHp}`);
  }

  private handleNPCApplyCondition(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Only DM can apply conditions
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player?.isDM) {
      this.sendError(ws, "Only the DM can apply conditions");
      return;
    }

    const npcId = payload.npcId as string;
    const condition = payload.condition as string;

    engine.applyConditionToNPC(npcId, condition);

    // Broadcast updated state to all players
    this.broadcastToGame(client.gameId, "DM_CONTROL_UPDATE", {
      action: "npc_apply_condition",
      npcId,
      condition,
      gameState: engine.game,
    });

    console.log(`[DM Control] Applied condition ${condition} to NPC ${npcId}`);
  }

  private handleNPCRemoveCondition(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Only DM can remove conditions
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player?.isDM) {
      this.sendError(ws, "Only the DM can remove conditions");
      return;
    }

    const npcId = payload.npcId as string;
    const condition = payload.condition as string;

    engine.removeConditionFromNPC(npcId, condition);

    // Broadcast updated state to all players
    this.broadcastToGame(client.gameId, "DM_CONTROL_UPDATE", {
      action: "npc_remove_condition",
      npcId,
      condition,
      gameState: engine.game,
    });

    console.log(`[DM Control] Removed condition ${condition} from NPC ${npcId}`);
  }

  private handleNPCDelete(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Only DM can delete NPCs
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player?.isDM) {
      this.sendError(ws, "Only the DM can delete NPCs");
      return;
    }

    const npcId = payload.npcId as string;

    engine.deleteNPC(npcId);

    // Broadcast updated state to all players
    this.broadcastToGame(client.gameId, "DM_CONTROL_UPDATE", {
      action: "npc_delete",
      npcId,
      gameState: engine.game,
    });

    console.log(`[DM Control] Deleted NPC ${npcId}`);
  }

  private handlePlayerAwardXP(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Only DM can award XP
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player?.isDM) {
      this.sendError(ws, "Only the DM can award XP");
      return;
    }

    const playerId = payload.playerId as string;
    const amount = payload.amount as number;

    engine.awardXPToPlayer(playerId, amount);

    // Broadcast updated state to all players
    this.broadcastToGame(client.gameId, "DM_CONTROL_UPDATE", {
      action: "player_award_xp",
      playerId,
      amount,
      gameState: engine.game,
    });

    console.log(`[DM Control] Awarded ${amount} XP to player ${playerId}`);
  }

  private handlePlayerLevelUp(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Only DM can level up players
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player?.isDM) {
      this.sendError(ws, "Only the DM can level up players");
      return;
    }

    const playerId = payload.playerId as string;

    engine.levelUpPlayer(playerId);

    // Broadcast updated state to all players
    this.broadcastToGame(client.gameId, "DM_CONTROL_UPDATE", {
      action: "player_level_up",
      playerId,
      gameState: engine.game,
    });

    console.log(`[DM Control] Leveled up player ${playerId}`);
  }

  // ---- Inventory & Equipment Handlers ----

  private handleInventoryAddItem(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Only DM can add items to player inventory
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player?.isDM) {
      this.sendError(ws, "Only the DM can add items");
      return;
    }

    const itemPayload = payload.item as Record<string, unknown>;
    const itemId = payload.itemId as string;
    const itemName = itemPayload.name as string;
    const itemType = itemPayload.type as string;
    const itemWeight = (itemPayload.weight as number) || 0;

    engine.addItemToInventory(client.playerId, {
      id: itemId || `item_${Date.now()}`,
      name: itemName,
      type: itemType as "weapon" | "armor" | "consumable" | "misc",
      description: itemPayload.description as string,
      weight: itemWeight,
      stats: itemPayload.stats as any,
    });

    this.broadcastToGame(client.gameId, "INVENTORY_UPDATE", {
      playerId: client.playerId,
      action: "add_item",
      item: { id: itemId, name: itemName, type: itemType },
    });

    console.log(`[Inventory] Added item ${itemName} to player ${client.playerId}`);
  }

  private handleEquipWeapon(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    const itemId = payload.itemId as string;
    engine.equipWeapon(client.playerId, itemId);

    this.broadcastToGame(client.gameId, "EQUIPMENT_UPDATE", {
      playerId: client.playerId,
      slot: "weapon",
      itemId,
    });

    console.log(`[Equipment] Player ${client.playerId} equipped weapon ${itemId}`);
  }

  private handleEquipArmor(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    const itemId = payload.itemId as string;
    engine.equipArmor(client.playerId, itemId);

    this.broadcastToGame(client.gameId, "EQUIPMENT_UPDATE", {
      playerId: client.playerId,
      slot: "armor",
      itemId,
    });

    console.log(`[Equipment] Player ${client.playerId} equipped armor ${itemId}`);
  }

  private handleUnequipWeapon(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    engine.unequipWeapon(client.playerId);

    this.broadcastToGame(client.gameId, "EQUIPMENT_UPDATE", {
      playerId: client.playerId,
      slot: "weapon",
      itemId: null,
    });

    console.log(`[Equipment] Player ${client.playerId} unequipped weapon`);
  }

  private handleUnequipArmor(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    engine.unequipArmor(client.playerId);

    this.broadcastToGame(client.gameId, "EQUIPMENT_UPDATE", {
      playerId: client.playerId,
      slot: "armor",
      itemId: null,
    });

    console.log(`[Equipment] Player ${client.playerId} unequipped armor`);
  }

  private handleUseItem(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    const itemId = payload.itemId as string;
    const targetId = payload.targetId as string | undefined;

    engine.useItem(client.playerId, itemId, targetId);

    this.broadcastToGame(client.gameId, "ITEM_USED", {
      playerId: client.playerId,
      itemId,
      targetId,
    });

    console.log(`[Inventory] Player ${client.playerId} used item ${itemId}`);
  }

  // ---- Buff/Debuff Handlers ----

  private handleApplyTemporaryHP(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Only DM can apply temporary HP
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player?.isDM) {
      this.sendError(ws, "Only the DM can apply temporary HP");
      return;
    }

    const targetId = payload.targetId as string;
    const amount = (payload.amount as number) || 0;
    const duration = (payload.duration as number) || 1;
    const isPlayer = (payload.isPlayer as boolean) || true;

    if (isPlayer) {
      engine.applyTemporaryHP(targetId, amount, duration);
    } else {
      engine.applyTemporaryHPToNPC(targetId, amount, duration);
    }

    this.broadcastToGame(client.gameId, "BUFF_UPDATE", {
      action: "apply_temporary_hp",
      targetId,
      isPlayer,
      amount,
      duration,
    });

    console.log(`[Buff] Applied ${amount} temporary HP to ${targetId} for ${duration} rounds`);
  }

  private handleApplyBuff(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Only DM can apply buffs
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player?.isDM) {
      this.sendError(ws, "Only the DM can apply buffs");
      return;
    }

    const targetId = payload.targetId as string;
    const buff = payload.buff as { name: string; effect: string; bonus?: number; duration: number };
    const isPlayer = (payload.isPlayer as boolean) || true;

    if (isPlayer) {
      engine.applyBuff(targetId, buff);
    } else {
      engine.applyBuffToNPC(targetId, buff);
    }

    this.broadcastToGame(client.gameId, "BUFF_UPDATE", {
      action: "apply_buff",
      targetId,
      isPlayer,
      buff,
    });

    console.log(`[Buff] Applied ${buff.name} to ${targetId} for ${buff.duration} rounds`);
  }

  private handleRemoveBuff(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    if (!client.gameId || !client.playerId) {
      this.sendError(ws, "Not in a game");
      return;
    }

    const engine = gameStore.getGame(client.gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Only DM can remove buffs
    const player = engine.game.players.find(p => p.id === client.playerId);
    if (!player?.isDM) {
      this.sendError(ws, "Only the DM can remove buffs");
      return;
    }

    const targetId = payload.targetId as string;
    const buffName = payload.buffName as string;
    const isPlayer = (payload.isPlayer as boolean) || true;

    if (isPlayer) {
      engine.removeBuff(targetId, buffName);
    } else {
      // NPCs don't have removeBuff method yet, but we can filter directly
      const npc = engine.game.npcs.find(n => n.id === targetId);
      if (npc && npc.buffs) {
        npc.buffs = npc.buffs.filter(b => b.name !== buffName);
      }
    }

    this.broadcastToGame(client.gameId, "BUFF_UPDATE", {
      action: "remove_buff",
      targetId,
      isPlayer,
      buffName,
    });

    console.log(`[Buff] Removed ${buffName} from ${targetId}`);
  }

  shutdown(): void {
    // Clear all timer broadcast intervals
    for (const interval of this.timerBroadcastIntervals.values()) {
      clearInterval(interval);
    }
    this.timerBroadcastIntervals.clear();
    
    this.clients.forEach((_, ws) => ws.close());
    this.wss.close();
  }
}
