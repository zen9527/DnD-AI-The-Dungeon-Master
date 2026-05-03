import { WebSocket, WebSocketServer } from "ws";
import { gameStore } from "../game/store.js";
import { buildSystemPrompt } from "../llm/prompts.js";
import { getLocalizedMessage } from "../utils/locale-loader.js";
// Hit dice by class (D&D 5e standard)
function getHitDiceForClass(characterClass) {
    const hdMap = {
        Barbarian: 4, Fighter: 3, Paladin: 3, Ranger: 3,
        Cleric: 2, Druid: 2, Monk: 2, Rogue: 2,
        Sorcerer: 1, Warlock: 1, Wizard: 1, Bard: 1,
    };
    return hdMap[characterClass] || 1;
}
import { createGameSchema, joinGameSchema, playerActionSchema, chatMessageSchema } from "../../shared/index.js";
export class WebSocketManager {
    wss;
    clients;
    nextConnectionId;
    constructor(server) {
        this.wss = new WebSocketServer({ server });
        this.clients = new Map();
        this.nextConnectionId = 1;
        this.initialize();
    }
    initialize() {
        this.wss.on("connection", (ws, req) => {
            const connectionId = `conn_${this.nextConnectionId++}`;
            this.clients.set(ws, { id: connectionId, gameId: null, playerId: null });
            console.log(`[WS] Client connected (${connectionId})`);
            ws.on("message", (data) => {
                this.handleMessage(ws, data);
            });
            ws.on("close", () => {
                const client = this.clients.get(ws);
                console.log(`[WS] Client disconnected (${connectionId})`);
                if (client?.gameId) {
                    gameStore.getGame(client.gameId)?.addChatMessage(client.playerId, `${client.id} has disconnected`);
                }
                this.clients.delete(ws);
            });
            ws.on("error", (error) => {
                console.error(`[WS] Error for ${connectionId}:`, error.message);
            });
            this.send(ws, "GAME_STATE", { message: "Connected to DnD server" });
        });
    }
    handleMessage(ws, data) {
        try {
            const message = JSON.parse(data.toString());
            this.routeMessage(ws, message);
        }
        catch {
            this.sendError(ws, "Invalid message format");
        }
    }
    routeMessage(ws, message) {
        const client = this.clients.get(ws);
        const payload = message.payload;
        switch (message.type) {
            case "CREATE_GAME":
                this.handleCreateGame(ws, payload);
                break;
            case "JOIN_GAME":
                this.handleJoinGame(ws, client, payload);
                break;
            case "LIST_GAMES":
                this.handleListGames(ws);
                break;
            case "PLAYER_ACTION":
                this.handlePlayerAction(ws, client, payload);
                break;
            case "CHAT_MESSAGE":
                this.handleChatMessage(ws, client, payload);
                break;
            case "SET_LOCALE":
                this.handleSetLocale(ws, client, payload);
                break;
            case "DICE_ROLL":
                this.handleDiceRoll(ws, client, payload);
                break;
            case "NPC_CREATE":
                this.handleNPCCreate(ws, client, payload);
                break;
            case "EVENT_CREATE":
                this.handleEventCreate(ws, client, payload);
                break;
            default:
                this.sendError(ws, `Unknown message type: ${message.type}`);
        }
    }
    handleCreateGame(ws, payload) {
        const parsed = createGameSchema.safeParse(payload);
        if (!parsed.success) {
            this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
            return;
        }
        const p = parsed.data;
        const player = {
            id: this.clients.get(ws).id,
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
            conditions: [],
            hitDice: { total: getHitDiceForClass(p.characterClass), used: 0 },
            deathSaves: { successes: 0, failures: 0 },
            xp: 0,
            locale: payload.locale || "en-US",
        };
        const scenario = payload.scenario || "dungeon";
        const engine = gameStore.createGame(payload.gameName || "New Adventure", payload.maxPlayers || 4, scenario, player);
        this.clients.set(ws, { id: this.clients.get(ws).id, gameId: engine.id, playerId: player.id });
        this.send(ws, "GAME_CREATED", { gameId: engine.id, game: engine.game });
        // Generate opening scene via LLM (delay + retry)
        const locale = player.locale || "en-US";
        this.send(ws, "STREAM_CHUNK", { content: getLocalizedMessage(locale, "status.dm_preparing"), isFinal: false });
        setTimeout(() => {
            console.log(`[OpeningScene] Attempting generation (game: ${engine.id})`);
            let attempt = 0;
            const tryGenerate = async () => {
                attempt++;
                console.log(`[OpeningScene] Attempt ${attempt} (game: ${engine.id})`);
                try {
                    // Pass only onChunk and onError to engine - handle onEnd manually AFTER await
                    const parsed = await engine.generateOpeningScene({
                        onChunk: (chunk) => {
                            this.broadcastToGame(engine.id, "STREAM_CHUNK", { content: chunk, isFinal: false });
                        },
                        onEnd: () => {
                            // Don't use - we'll broadcast after state updates complete
                        },
                        onError: (error) => {
                            const isConnectionError = error.message.includes("unreachable") || error.message.includes("ECONNREFUSED");
                            const isTimeout = error.message.includes("timed out") || error.message.includes("idle timeout");
                            if (attempt < 4 && (isConnectionError || isTimeout)) {
                                console.log(`[OpeningScene] Attempt ${attempt} failed (${isTimeout ? "timeout" : "connection"}), retrying in 3s...`);
                                setTimeout(() => tryGenerate(), 3000);
                            }
                            else {
                                console.error(`[OpeningScene] Failed after ${attempt} attempts:`, error.message);
                                const fallback = `The world forms around "${player.characterName}"... The adventure begins.`;
                                // Persist fallback narrative to chatHistory so it survives page refresh
                                engine.addEvent("DM", fallback);
                                this.broadcastToGame(engine.id, "STREAM_ERROR", {
                                    message: error.message,
                                    fallbackNarrative: fallback,
                                });
                            }
                        },
                    });
                    // AFTER await completes - engine method has updated chatHistory
                    console.log(`[OpeningScene] Generation complete (game: ${engine.id})`);
                    this.broadcastToGame(engine.id, "STREAM_END", {
                        fullNarrative: parsed.fullNarrative,
                        structured: engine.game, // Public getter returns a fresh snapshot
                    });
                }
                catch (error) {
                    if (!(error instanceof Error && error.message.includes("Failed after"))) {
                        console.error(`[OpeningScene] Unexpected error:`, error);
                        const fallback = `The world forms around "${player.characterName}"... The adventure begins.`;
                        engine.addEvent("DM", fallback);
                        this.broadcastToGame(engine.id, "STREAM_ERROR", {
                            message: error instanceof Error ? error.message : "Unknown error",
                            fallbackNarrative: fallback,
                        });
                    }
                }
            };
            tryGenerate();
        }, 5000);
    }
    handleJoinGame(ws, client, payload) {
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
        const player = {
            id: this.clients.get(ws).id,
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
            conditions: [],
            hitDice: { total: getHitDiceForClass(p.characterClass), used: 0 },
            deathSaves: { successes: 0, failures: 0 },
            xp: 0,
            locale: payload.locale || "en-US",
        };
        gameStore.joinGame(p.gameId, player);
        this.clients.set(ws, { id: this.clients.get(ws).id, gameId: engine.id, playerId: player.id });
        // Send join notification to all players
        const joinLocale = player.locale || "en-US";
        const joinMsg = getLocalizedMessage(joinLocale, "player_joined.notification").replace("{name}", player.characterName);
        engine.addEvent("Player Joined", `${player.characterName} has joined the adventure`);
        this.broadcastToGame(engine.id, "CHAT_MESSAGE", {
            message: engine.game.chatHistory[engine.game.chatHistory.length - 1],
            gameState: engine.game,
        });
        // Send game state to the joining player
        this.send(ws, "PLAYER_JOINED", {
            gameId: engine.id,
            player,
            gameState: engine.game,
        });
        // Broadcast updated state to other players (excluding the joining player)
        this.broadcastToGame(engine.id, "PLAYER_JOINED", { player, gameState: engine.game }, ws);
        // If this is the first player joining (DM already in game), generate a welcome scene from DM
        if (engine.game.players.length > 1 && engine.game.chatHistory.length <= 1) {
            // DM is already in the game but no opening scene yet — generate one for the new player
            const dmPlayer = engine.game.players.find(pl => pl.isDM);
            if (dmPlayer) {
                this.send(ws, "STREAM_CHUNK", { content: getLocalizedMessage(joinLocale, "status.dm_preparing"), isFinal: false });
                setTimeout(() => {
                    engine.generateOpeningScene({
                        onChunk: (chunk) => {
                            this.broadcastToGame(engine.id, "STREAM_CHUNK", { content: chunk, isFinal: false });
                        },
                        onEnd: () => { },
                        onError: (error) => {
                            const fallback = `The world forms around "${player.characterName}"... The adventure begins.`;
                            engine.addEvent("DM", fallback);
                            this.broadcastToGame(engine.id, "STREAM_ERROR", {
                                message: error.message,
                                fallbackNarrative: fallback,
                            });
                        },
                    }).then((result) => {
                        this.broadcastToGame(engine.id, "STREAM_END", {
                            fullNarrative: result.fullNarrative,
                            structured: engine.game,
                        });
                    }).catch(() => { });
                }, 2000);
            }
        }
    }
    handleListGames(ws) {
        this.send(ws, "GAME_STATE", { games: gameStore.listGames() });
    }
    async handlePlayerAction(ws, client, payload) {
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
                onChunk: (chunk) => {
                    this.broadcastToGame(engine.id, "STREAM_CHUNK", { content: chunk, isFinal: false });
                },
                onEnd: () => {
                    // Don't use this - we'll broadcast after state updates complete
                },
                onError: (error) => {
                    const fallback = `You attempt: "${actionPayload.action}". The result is uncertain...`;
                    engine.addEvent("DM", fallback);
                    this.broadcastToGame(engine.id, "STREAM_ERROR", {
                        message: error.message,
                        fallbackNarrative: fallback,
                    });
                },
            });
            // AFTER await completes - engine method has updated chatHistory with DM response
            console.log(`[DM Response] Complete for player ${client.playerId}`);
            this.broadcastToGame(engine.id, "STREAM_END", {
                fullNarrative: parsed.fullNarrative,
                structured: engine.game, // Public getter returns fresh snapshot after state update
            });
        }
        catch (error) {
            if (!(error instanceof Error && error.message.includes("You attempt"))) {
                console.error(`[DM Response] Unexpected error for player ${client.playerId}:`, error);
            }
        }
    }
    handleChatMessage(ws, client, payload) {
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
            gameState: engine.game // Send full game state to ensure consistency
        });
    }
    handleSetLocale(ws, client, payload) {
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
        const newLocale = payload.locale || "en-US";
        player.locale = newLocale;
        // Update system prompt in conversation history with new locale
        const scenario = engine.game.scenario || "dungeon";
        if (engine.game.conversationHistory.length > 0) {
            engine.game.conversationHistory[0] = {
                role: "system",
                content: buildSystemPrompt(scenario, newLocale),
            };
        }
        this.send(ws, "LOCALE_UPDATED", { locale: newLocale });
    }
    handleDiceRoll(ws, client, payload) {
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
        const diceType = payload.diceType || 20;
        const count = payload.count || 1;
        const modifier = payload.modifier || 0;
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
    handleNPCCreate(ws, client, payload) {
        if (!client.gameId) {
            this.sendError(ws, "Not in a game");
            return;
        }
        const engine = gameStore.getGame(client.gameId);
        if (!engine) {
            this.sendError(ws, "Game not found");
            return;
        }
        engine.addNPC(payload.name, payload.description || "", payload.role || "neutral");
        this.broadcastToGame(engine.id, "NPC_CREATED", { npc: engine.game.npcs[engine.game.npcs.length - 1] });
    }
    handleEventCreate(ws, client, payload) {
        if (!client.gameId) {
            this.sendError(ws, "Not in a game");
            return;
        }
        const engine = gameStore.getGame(client.gameId);
        if (!engine) {
            this.sendError(ws, "Game not found");
            return;
        }
        engine.addEvent(payload.title, payload.description || "");
        this.broadcastToGame(engine.id, "EVENT_CREATED", { event: engine.game.chatHistory[engine.game.chatHistory.length - 1] });
    }
    send(ws, type, payload) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type, payload }));
        }
    }
    sendError(ws, errorMessage) {
        this.send(ws, "ERROR", { message: errorMessage });
    }
    broadcastToGame(gameId, type, payload, excludeWs) {
        this.clients.forEach((client, ws) => {
            if (ws !== excludeWs && ws.readyState === WebSocket.OPEN && client.gameId === gameId) {
                this.send(ws, type, payload);
            }
        });
    }
    shutdown() {
        this.clients.forEach((_, ws) => ws.close());
        this.wss.close();
    }
}
//# sourceMappingURL=manager.js.map