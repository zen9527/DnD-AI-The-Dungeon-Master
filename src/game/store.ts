import { GameEngine } from "./engine.js";
import { generateId } from "../utils/id.js";
import { configManager } from "../utils/config.js";
import * as storage from "../utils/storage.js";
import type { Game, Player, ChatMessage, NPC } from "../types/index.js";

interface Snapshot {
  gameId: string;
  data: string;
  timestamp: number;
}

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
    this.cleanupInterval = setInterval(() => this.saveSnapshots(), 300000);
  }

  private saveSnapshots(): void {
    for (const [gameId, engine] of this.games.entries()) {
      if (engine.getPlayerCount() === 0) continue;
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
      config.llmBaseUrl,
      config.llmApiKey,
      config.llmModel
    );
    this.games.set(gameId, engine);
    console.log(`[GameStore] Created game "${gameName}" (ID: ${gameId}, scenario: ${scenario})`);
    return engine;
  }

  getGame(gameId: string): GameEngine | undefined {
    return this.games.get(gameId);
  }

  joinGame(gameId: string, player: Player): void {
    const engine = this.games.get(gameId);
    if (!engine) throw new Error(`Game not found: ${gameId}`);
    if (engine.getPlayerCount() >= engine.getMaxPlayers()) throw new Error("Game is full");
    engine.addPlayer(player);
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

  cleanupEmptyGames(olderThanMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [gameId, engine] of this.games.entries()) {
      if (engine.getPlayerCount() === 0 && (now - engine.getCreatedAt() > olderThanMs)) {
        this.games.delete(gameId);
        this.snapshots.delete(gameId);
        cleaned++;
      }
    }
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
          config.llmBaseUrl,
          config.llmApiKey,
          config.llmModel
        );
        this.games.set(gameMeta.id, engine);
      }
    }
  }

  startAutoSave(): NodeJS.Timeout {
    return setInterval(() => this.saveAllGames(), 60000);
  }
}

export const gameStore = new GameStore();
