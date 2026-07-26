import { gameStore } from "../../game/store.js";
import type { GameEngine } from "../../game/engine.js";
import { createPlayer } from "../../game/player-factory.js";
import { buildSystemPrompt } from "../../llm/prompts.js";
import { type Scenario } from "../../../shared/schemas/scenario.js";
import { getLocalizedMessage } from "../../utils/locale-loader.js";
import { createGameSchema, joinGameSchema, playerActionSchema, saveGameSchema } from "../../../shared/index.js";
import { parsePayload, requireDM, requireGame, requirePlayer } from "../guards.js";
import { playerSessions } from "../sessions.js";
import * as storage from "../../utils/storage.js";
import { rejoinGameSchema } from "../../../shared/index.js";
import type { HandlerContext, HandlerRegistry, ManagerApi } from "../types.js";

/** The DM stalls for a few seconds before the opening scene so the lobby settles. */
const OPENING_SCENE_DELAY_MS = 5000;
const JOIN_SCENE_DELAY_MS = 2000;
const OPENING_SCENE_RETRY_DELAY_MS = 3000;
const OPENING_SCENE_MAX_ATTEMPTS = 4;

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Connection hiccups and idle timeouts are worth retrying; bad prompts are not. */
function isRetryableLLMError(error: Error): boolean {
  const message = error.message;
  return (
    message.includes("unreachable") ||
    message.includes("ECONNREFUSED") ||
    message.includes("timed out") ||
    message.includes("idle timeout")
  );
}

interface OpeningSceneOptions {
  /** How many times to call the LLM before giving up and using the fallback text. */
  maxAttempts?: number;
  /** Start the engine's turn timer and the periodic broadcast (game creation only). */
  startTimer?: boolean;
}

/**
 * Stream the opening narrative to everyone in the game, retrying transient LLM
 * failures. On permanent failure a fallback narrative is persisted to chat
 * history so it survives a page refresh.
 */
async function streamOpeningScene(
  manager: ManagerApi,
  engine: GameEngine,
  characterName: string,
  options: OpeningSceneOptions = {}
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[OpeningScene] Attempt ${attempt} (game: ${engine.id})`);
      const result = await engine.generateOpeningScene({
        onChunk: (chunk: string) => {
          manager.broadcastToGame(engine.id, "STREAM_CHUNK", { content: chunk, isFinal: false });
        },
        // State is broadcast below, once the await has resolved and the engine
        // has finished writing to chatHistory.
        onEnd: () => {},
        onError: () => {},
      });

      const latestMessage = engine.game.chatHistory[engine.game.chatHistory.length - 1];
      if (latestMessage) {
        manager.broadcastToGame(engine.id, "CHAT_MESSAGE", { message: latestMessage, gameState: engine.game });
      }

      manager.broadcastToGame(engine.id, "STREAM_END", {
        fullNarrative: result.fullNarrative,
        structured: engine.game,
      });

      const dmPlayer = engine.game.players.find(p => p.isDM);
      if (dmPlayer) {
        if (options.startTimer) {
          engine.startTimer();
          manager.startTimerBroadcast(engine.id);
        }
        manager.broadcastToGame(engine.id, "TURN_TIMER", {
          remaining: engine.timerRemaining,
          currentPlayerId: dmPlayer.id,
          characterName: dmPlayer.characterName,
        });
      }
      return;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts && isRetryableLLMError(err)) {
        console.log(`[OpeningScene] Attempt ${attempt} failed (${err.message}), retrying in ${OPENING_SCENE_RETRY_DELAY_MS / 1000}s...`);
        await delay(OPENING_SCENE_RETRY_DELAY_MS);
        continue;
      }

      console.error(`[OpeningScene] Failed after ${attempt} attempt(s):`, err.message);
      const fallback = `The world forms around "${characterName}"... The adventure begins.`;
      engine.addEvent("DM", fallback);
      manager.broadcastToGame(engine.id, "STREAM_ERROR", { message: err.message, fallbackNarrative: fallback });
      return;
    }
  }
}

/** Fire-and-forget wrapper so an unhandled rejection can never take the server down. */
function scheduleOpeningScene(
  manager: ManagerApi,
  engine: GameEngine,
  characterName: string,
  delayMs: number,
  options: OpeningSceneOptions
): void {
  setTimeout(() => {
    streamOpeningScene(manager, engine, characterName, options).catch(err => {
      console.error(`[OpeningScene] Unhandled rejection:`, err instanceof Error ? err.message : err);
    });
  }, delayMs);
}

/** CREATE_GAME — register a new game with its creator as DM, then open the scene. */
function handleCreateGame(ctx: HandlerContext): void {
  const p = parsePayload(ctx, createGameSchema);
  if (!p) return;

  const player = createPlayer({
    id: ctx.client.id,
    name: p.playerName,
    characterName: p.characterName,
    race: p.race,
    characterClass: p.characterClass,
    attributes: p.attributes,
    isDM: true,
    locale: p.locale,
  });

  const engine = gameStore.createGame(p.gameName, p.maxPlayers, p.scenario, player);
  ctx.manager.attachClient(ctx.ws, { id: ctx.client.id, gameId: engine.id, playerId: player.id });

  // Sent only to this socket — never broadcast; see sessions.ts.
  const playerToken = playerSessions.issue(engine.id, player.id);
  ctx.manager.send(ctx.ws, "GAME_CREATED", { gameId: engine.id, game: engine.game, playerToken });
  ctx.manager.send(ctx.ws, "STREAM_CHUNK", {
    content: getLocalizedMessage(player.locale, "status.dm_preparing"),
    isFinal: false,
    isStatus: true,
  });

  scheduleOpeningScene(ctx.manager, engine, player.characterName, OPENING_SCENE_DELAY_MS, {
    maxAttempts: OPENING_SCENE_MAX_ATTEMPTS,
    startTimer: true,
  });
}

/** JOIN_GAME — join a running game, loading it from disk if it isn't in memory. */
function handleJoinGame(ctx: HandlerContext): void {
  const p = parsePayload(ctx, joinGameSchema);
  if (!p) return;

  const engine = gameStore.getGame(p.gameId) ?? gameStore.loadSingleGame(p.gameId);
  if (!engine) {
    ctx.manager.sendError(ctx.ws, "Game not found");
    return;
  }

  if (engine.getPlayerCount() >= engine.getMaxPlayers()) {
    ctx.manager.sendError(ctx.ws, "Game is full");
    return;
  }

  const player = createPlayer({
    id: ctx.client.id,
    name: p.playerName,
    characterName: p.characterName,
    race: p.race,
    characterClass: p.characterClass,
    attributes: p.attributes,
    locale: p.locale,
  });

  engine.addPlayer(player);
  ctx.manager.attachClient(ctx.ws, { id: ctx.client.id, gameId: engine.id, playerId: player.id });

  engine.addEvent("Player Joined", `${player.characterName} has joined the adventure`);
  ctx.manager.broadcastToGame(engine.id, "CHAT_MESSAGE", {
    message: engine.game.chatHistory[engine.game.chatHistory.length - 1],
    gameState: engine.game,
  });

  const playerToken = playerSessions.issue(engine.id, player.id);
  ctx.manager.send(ctx.ws, "PLAYER_JOINED", { gameId: engine.id, player, gameState: engine.game, playerToken });
  // The broadcast copy deliberately omits the token.
  ctx.manager.broadcastToGame(engine.id, "PLAYER_JOINED", { player, gameState: engine.game }, ctx.ws);

  // A freshly loaded save has no DM and no history yet; otherwise the existing DM
  // narrates a welcome scene for the new arrival. Either way the joining player
  // gets an opening narrative rather than an empty log.
  const hasDM = engine.game.players.some(pl => pl.isDM);
  const isFreshLoad = !hasDM && engine.game.chatHistory.length <= 1;
  if (!hasDM && !isFreshLoad) return;

  ctx.manager.send(ctx.ws, "STREAM_CHUNK", {
    content: getLocalizedMessage(player.locale, "status.dm_preparing"),
    isFinal: false,
    isStatus: true,
  });
  scheduleOpeningScene(ctx.manager, engine, player.characterName, JOIN_SCENE_DELAY_MS, {});
}

/**
 * REJOIN_GAME — reclaim a seat after a refresh.
 *
 * Without this, a refresh drops the player and the client has to invent a new
 * character, so a page reload silently replaced you with a stranger.
 */
function handleRejoinGame(ctx: HandlerContext): void {
  const parsed = parsePayload(ctx, rejoinGameSchema);
  if (!parsed) return;

  const seat = playerSessions.resolve(parsed.playerToken);
  const engine = seat ? gameStore.getGame(seat.gameId) ?? gameStore.loadSingleGame(seat.gameId) : null;
  const player = engine && seat ? engine.game.players.find(p => p.id === seat.playerId) : undefined;

  if (!seat || !engine || !player) {
    // Expired token or a game that no longer exists: tell the client to fall
    // back to the join form rather than leaving it on a blank screen.
    ctx.manager.send(ctx.ws, "REJOIN_FAILED", { gameId: parsed.gameId });
    return;
  }

  engine.setPlayerConnected(player.id, true);
  ctx.manager.attachClient(ctx.ws, { id: ctx.client.id, gameId: engine.id, playerId: player.id });

  ctx.manager.send(ctx.ws, "GAME_REJOINED", {
    gameId: engine.id,
    player: engine.game.players.find(p => p.id === player.id),
    gameState: engine.game,
    playerToken: parsed.playerToken,
  });
  // Others just need the refreshed roster; no "joined the adventure" event.
  ctx.manager.broadcastToGame(engine.id, "PLAYER_JOINED", { player, gameState: engine.game }, ctx.ws);

  console.log(`[Rejoin] ${player.characterName} reclaimed their seat in ${engine.id}`);
}

/**
 * LOAD_GAME — restore the game from its last save, in place.
 *
 * DM-only, because it rewinds the state for everyone at the table. Previously
 * the client faked this by reloading the browser, which never actually
 * restored anything.
 */
function handleLoadGame(ctx: HandlerContext): void {
  const resolved = requireDM(ctx, "load a saved game");
  if (!resolved) return;

  const saved = storage.loadGame(resolved.engine.id);
  if (!saved) {
    ctx.manager.sendError(ctx.ws, "No save found for this game");
    return;
  }

  resolved.engine.restoreFrom(saved);
  ctx.manager.startTimerBroadcast(resolved.engine.id);

  ctx.manager.broadcastToGame(resolved.engine.id, "GAME_LOADED", {
    gameId: resolved.engine.id,
    gameState: resolved.engine.game,
  });

  console.log(`[LoadGame] Restored ${resolved.engine.id} from disk`);
}

/** LIST_GAMES — lobby listing of in-memory and saved games. */
function handleListGames(ctx: HandlerContext): void {
  ctx.manager.send(ctx.ws, "GAME_STATE", { games: gameStore.listGames() });
}

/** PLAYER_ACTION — the core loop: echo the action, then stream the DM's response. */
async function handlePlayerAction(ctx: HandlerContext): Promise<void> {
  const resolved = requirePlayer(ctx);
  if (!resolved) return;
  const { engine, player } = resolved;

  const actionPayload = parsePayload(ctx, playerActionSchema);
  if (!actionPayload) return;

  const playerId = ctx.client.playerId!;

  // Echo the player's action first so it appears above the DM's reply.
  engine.addChatMessage(playerId, actionPayload.action);
  ctx.manager.broadcastToGame(engine.id, "CHAT_MESSAGE", {
    message: engine.game.chatHistory[engine.game.chatHistory.length - 1],
    gameState: engine.game,
  });

  const locale = player.locale || "en-US";
  ctx.manager.send(ctx.ws, "STREAM_CHUNK", {
    content: getLocalizedMessage(locale, "status.dm_considers"),
    isFinal: false,
    isStatus: true,
  });

  let result;
  try {
    result = await engine.handlePlayerAction(actionPayload, playerId, {
      onChunk: (chunk: string) => {
        ctx.manager.broadcastToGame(engine.id, "STREAM_CHUNK", { content: chunk, isFinal: false });
      },
      // Broadcast happens after the await so the engine's state updates are visible.
      onEnd: () => {},
      onError: () => {},
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[DM Response] Failed for player ${playerId}:`, message);
    const fallback = `You attempt: "${actionPayload.action}". The result is uncertain...`;
    engine.addEvent("DM", fallback);
    ctx.manager.broadcastToGame(engine.id, "STREAM_ERROR", { message, fallbackNarrative: fallback });
    return;
  }

  const latestMessage = engine.game.chatHistory[engine.game.chatHistory.length - 1];
  if (latestMessage?.type === "narrative") {
    ctx.manager.broadcastToGame(engine.id, "CHAT_MESSAGE", { message: latestMessage, gameState: engine.game });
  }

  ctx.manager.broadcastToGame(engine.id, "STREAM_END", {
    fullNarrative: result.fullNarrative,
    structured: engine.game,
  });

  // The engine already advanced the turn; restart the countdown for whoever is up.
  const currentPlayer = engine.getCurrentPlayer();
  if (currentPlayer) {
    ctx.manager.broadcastToGame(engine.id, "TURN_TIMER", {
      remaining: engine.timerRemaining,
      currentPlayerId: currentPlayer.id,
      characterName: currentPlayer.characterName,
      expired: engine.timerExpired,
    });
    ctx.manager.startTimerBroadcast(engine.id);
  }
}

/** SET_LOCALE — switch a player's UI language and the DM's narration language. */
function handleSetLocale(ctx: HandlerContext): void {
  const resolved = requirePlayer(ctx);
  if (!resolved) return;
  const { engine, player } = resolved;

  const newLocale = (ctx.payload.locale as string) || "en-US";
  // `player` comes from the snapshot getter, so go through the engine to mutate.
  engine.setPlayerLocale(player.id, newLocale);

  // Rewrite the system prompt so subsequent DM narration switches language too.
  const scenario = (engine.game.scenario as Scenario) || "dungeon";
  engine.setSystemPrompt(buildSystemPrompt(scenario, newLocale));

  ctx.manager.send(ctx.ws, "LOCALE_UPDATED", { locale: newLocale });
}

/** SAVE_GAME — persist the caller's game to disk. */
function handleSaveGame(ctx: HandlerContext): void {
  const parsed = parsePayload(ctx, saveGameSchema);
  if (!parsed) return;

  if (ctx.client.gameId !== parsed.gameId) {
    ctx.manager.sendError(ctx.ws, "You are not in this game");
    return;
  }

  const engine = requireGame(ctx);
  if (!engine) return;

  try {
    engine.saveGame();
    ctx.manager.broadcastToGame(parsed.gameId, "GAME_SAVED", { gameId: parsed.gameId, timestamp: Date.now() });
    console.log(`[SaveGame] Game ${parsed.gameId} saved successfully`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    ctx.manager.sendError(ctx.ws, `Failed to save game: ${message}`);
    console.error(`[SaveGame] Failed to save game ${parsed.gameId}:`, error);
  }
}

export const gameHandlers: HandlerRegistry = {
  CREATE_GAME: handleCreateGame,
  JOIN_GAME: handleJoinGame,
  REJOIN_GAME: handleRejoinGame,
  LOAD_GAME: handleLoadGame,
  LIST_GAMES: handleListGames,
  PLAYER_ACTION: handlePlayerAction,
  SET_LOCALE: handleSetLocale,
  SAVE_GAME: handleSaveGame,
};
