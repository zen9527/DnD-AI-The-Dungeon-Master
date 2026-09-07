import { log } from "../utils/logger.js";
import { GameEngine } from "./engine.js";
import { generateId } from "../utils/id.js";
import { configManager } from "../utils/config.js";
import * as storage from "../utils/storage.js";
import type { LLMConfig } from "../llm/client.js";
import { playerSessions } from "../websocket/sessions.js";
import type { Game, Player, ChatMessage, NPC } from "../types/index.js";

/** Project the .env config onto the LLM client's config shape. */
function toLLMConfig(config: ReturnType<typeof configManager.read>): LLMConfig {
  return {
    provider: config.llmProvider,
    baseUrl: config.llmBaseUrl,
    apiKey: config.llmApiKey,
    model: config.llmModel,
  };
}

const AUTO_SAVE_INTERVAL_MS = 60000;
/** How long a narration waits before its save fires — long enough for the
 *  follow-up state writes of the same turn to join the one write. */
const POST_NARRATION_SAVE_DELAY_MS = 5000;
/** How long an empty game stays in memory before it is reclaimed. */
const EMPTY_GAME_TTL_MS = 3600000;

export class GameStore {
  private games: Map<string, GameEngine>;
  /** Per-game debounce for the save that follows a finished narration. */
  private pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.games = new Map();
  }

  /** Persist a game shortly after a narration lands; repeated calls coalesce. */
  schedulePostNarrationSave(gameId: string, delayMs = POST_NARRATION_SAVE_DELAY_MS): void {
    const existing = this.pendingSaves.get(gameId);
    if (existing) clearTimeout(existing);

    this.pendingSaves.set(gameId, setTimeout(() => {
      this.pendingSaves.delete(gameId);
      const engine = this.games.get(gameId);
      if (engine && engine.hasUnsavedChanges) engine.saveGame();
    }, delayMs));
  }

  private cancelPendingSave(gameId: string): void {
    const pending = this.pendingSaves.get(gameId);
    if (pending) {
      clearTimeout(pending);
      this.pendingSaves.delete(gameId);
    }
  }

  createGame(
    gameName: string,
    maxPlayers: number,
    scenario: string,
    firstPlayer: Player
  ): GameEngine {
    const gameId = generateId();
    // Read fresh config from .env at runtime (not cached)
    const config = configManager.read();
    const engine = new GameEngine(
      { 
        id: gameId, 
        name: gameName, 
        maxPlayers, 
        scenario, 
        players: [firstPlayer], 
        npcs: [], 
        chatHistory: [], 
        combatMode: false,
        initiativeOrder: [],
        currentRound: 1,
        currentTurnIndex: 0
      },
      toLLMConfig(config)
    );
    this.games.set(gameId, engine);
    log.info(`[GameStore] Created game "${gameName}" (ID: ${gameId}, scenario: ${scenario})`);
    return engine;
  }

  getGame(gameId: string): GameEngine | undefined {
    return this.games.get(gameId);
  }

  deleteGame(gameId: string): boolean {
    const deleted = this.games.delete(gameId);
    if (deleted) {
      this.cancelPendingSave(gameId);
      log.info(`[GameStore] Deleted game: ${gameId}`);
    }
    return deleted;
  }

  /**
   * Drop games that everyone has left and that are older than the cutoff.
   * They stay on disk — this only frees the in-memory engine, so an abandoned
   * campaign can still be reopened from the campaign book.
   */
  cleanupEmptyGames(olderThanMs: number = EMPTY_GAME_TTL_MS): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [gameId, engine] of this.games.entries()) {
      if (engine.getConnectedPlayerCount() === 0 && now - engine.getCreatedAt() > olderThanMs) {
        engine.stopTimer();
        this.games.delete(gameId);
        this.cancelPendingSave(gameId);
        playerSessions.releaseGame(gameId);
        cleaned++;
      }
    }

    if (cleaned > 0) log.info(`[GameStore] Cleaned up ${cleaned} empty game(s)`);
    return cleaned;
  }

  getGameCount(): number {
    return this.games.size;
  }

  /** Write every game that has changed since its last save. */
  saveAllGames(): void {
    for (const engine of this.games.values()) {
      if (!engine.hasUnsavedChanges) continue;
      engine.saveGame();
    }
  }

  loadSavedGames(): void {
    const saved = storage.listGames();
    for (const gameMeta of saved) {
      const gameData = storage.loadGame(gameMeta.id);
      if (gameData) {
        // Recreate engine from saved game
        const config = configManager.read();
        const engine = new GameEngine(
          gameData,
          toLLMConfig(config)
        );
        this.games.set(gameMeta.id, engine);
      }
    }
  }

  loadSingleGame(gameId: string): GameEngine | null {
    if (this.games.has(gameId)) return this.games.get(gameId)!;
    
    const gameData = storage.loadGame(gameId);
    if (!gameData) return null;
    
    const config = configManager.read();
    const engine = new GameEngine(
      gameData,
      toLLMConfig(config)
    );
    this.games.set(gameId, engine);
    log.info(`[GameStore] Loaded single game ${gameId} from disk`);
    return engine;
  }

  /** Persist every live game on a timer, and reclaim abandoned ones. */
  startAutoSave(): NodeJS.Timeout {
    return setInterval(() => {
      this.saveAllGames();
      this.cleanupEmptyGames();
    }, AUTO_SAVE_INTERVAL_MS);
  }
}

export const gameStore = new GameStore();
