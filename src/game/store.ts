import { GameEngine } from "./engine.js";
import { generateId } from "../utils/id.js";
import type { Game, Player, ChatMessage, NPC } from "../types/index.js";

interface Snapshot {
  gameId: string;
  data: string;
  timestamp: number;
}

export class GameStore {
  private games: Map<string, GameEngine>;
  private snapshots: Map<string, Snapshot>;
  private llmBaseUrl: string;
  private llmApiKey: string | null;
  private llmModel: string;
  private cleanupInterval!: ReturnType<typeof setInterval>;

  constructor(llmBaseUrl: string, llmApiKey: string | null, llmModel: string) {
    this.games = new Map();
    this.snapshots = new Map();
    this.llmBaseUrl = llmBaseUrl;
    this.llmApiKey = llmApiKey;
    this.llmModel = llmModel;
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
    const engine = new GameEngine(
      { id: gameId, name: gameName, maxPlayers, scenario, players: [firstPlayer], npcs: [], chatHistory: [], events: [] },
      this.llmBaseUrl,
      this.llmApiKey,
      this.llmModel
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

  listGames(): Array<{ id: string; name: string; players: number; maxPlayers: number }> {
    return Array.from(this.games.values()).map(e => ({
      id: e.id,
      name: e.name,
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
}

export const gameStore = new GameStore(
  process.env.LLM_API_URL || "http://localhost:1234/v1",
  process.env.LLM_API_KEY || null,
  process.env.LLM_MODEL || "local-model"
);
