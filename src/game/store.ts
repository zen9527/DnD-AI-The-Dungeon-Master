import { GameEngine } from "./engine.js";
import { generateId } from "../utils/id.js";
import { configManager } from "../utils/config.js";
import * as storage from "../utils/storage.js";
import type { LLMConfig } from "../llm/client.js";
import { playerSessions } from "../websocket/sessions.js";
import type { Game, Player, ChatMessage, NPC } from "../types/index.js";

interface Snapshot {
  gameId: string;
  data: string;
  timestamp: number;
}

/** Project the .env config onto the LLM client's config shape. */
function toLLMConfig(config: ReturnType<typeof configManager.read>): LLMConfig {
  return {
    provider: config.llmProvider,
    baseUrl: config.llmBaseUrl,
    apiKey: config.llmApiKey,
    model: config.llmModel,
  };
}

const SNAPSHOT_INTERVAL_MS = 300000;
const AUTO_SAVE_INTERVAL_MS = 60000;
/** How long an empty game stays in memory before it is reclaimed. */
const EMPTY_GAME_TTL_MS = 3600000;

export class GameStore {
  private games: Map<string, GameEngine>;
  private snapshots: Map<string, Snapshot>;
  private cleanupInterval!: ReturnType<typeof setInterval>;

  constructor() {
    this.games = new Map();
    this.snapshots = new Map();
    this.startSnapshotTimer();
  }

  private startSnapshotTimer(): void {
    this.cleanupInterval = setInterval(() => this.saveSnapshots(), SNAPSHOT_INTERVAL_MS);
  }

  private saveSnapshots(): void {
    for (const [gameId, engine] of this.games.entries()) {
      if (engine.getConnectedPlayerCount() === 0) continue;
      const snapshot: Snapshot = {
        gameId,
        data: JSON.stringify(engine.game),
        timestamp: Date.now(),
      };
      this.snapshots.set(gameId, snapshot);
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
        events: [],
        combatMode: false,
        initiativeOrder: [],
        currentRound: 1,
        currentTurnIndex: 0
      },
      toLLMConfig(config)
    );
    this.games.set(gameId, engine);
    console.log(`[GameStore] Created game "${gameName}" (ID: ${gameId}, scenario: ${scenario})`);
    return engine;
  }

  getGame(gameId: string): GameEngine | undefined {
    return this.games.get(gameId);
  }

  listGames(): Array<{ id: string; name: string; scenario: string; players: number; maxPlayers: number }> {
    return Array.from(this.games.values()).map(e => ({
      id: e.id,
      name: e.name,
      scenario: e.game.scenario,
      players: e.getPlayerCount(),
      maxPlayers: e.getMaxPlayers(),
    }));
  }

  deleteGame(gameId: string): boolean {
    const deleted = this.games.delete(gameId);
    if (deleted) console.log(`[GameStore] Deleted game: ${gameId}`);
    return deleted;
  }

  /**
   * Drop games that everyone has left and that are older than the cutoff.
   * They stay on disk — this only frees the in-memory engine and its snapshot,
   * so an abandoned game can still be reloaded from the lobby.
   */
  cleanupEmptyGames(olderThanMs: number = EMPTY_GAME_TTL_MS): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [gameId, engine] of this.games.entries()) {
      if (engine.getConnectedPlayerCount() === 0 && now - engine.getCreatedAt() > olderThanMs) {
        engine.stopTimer();
        this.games.delete(gameId);
        this.snapshots.delete(gameId);
        playerSessions.releaseGame(gameId);
        cleaned++;
      }
    }

    if (cleaned > 0) console.log(`[GameStore] Cleaned up ${cleaned} empty game(s)`);
    return cleaned;
  }

  getGameCount(): number {
    return this.games.size;
  }

  saveAllGames(): void {
    for (const [id, engine] of this.games.entries()) {
      storage.saveGame(engine.game);
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
    console.log(`[GameStore] Loaded single game ${gameId} from disk`);
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
