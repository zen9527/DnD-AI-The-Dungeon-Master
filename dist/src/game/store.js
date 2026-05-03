import { GameEngine } from "./engine.js";
import { generateId } from "../utils/id.js";
import { configManager } from "../utils/config.js";
export class GameStore {
    games;
    snapshots;
    cleanupInterval;
    constructor() {
        this.games = new Map();
        this.snapshots = new Map();
        this.startSnapshotTimer();
    }
    startSnapshotTimer() {
        this.cleanupInterval = setInterval(() => this.saveSnapshots(), 300000);
    }
    saveSnapshots() {
        for (const [gameId, engine] of this.games.entries()) {
            if (engine.getPlayerCount() === 0)
                continue;
            const snapshot = {
                gameId,
                data: JSON.stringify(engine.game),
                timestamp: Date.now(),
            };
            this.snapshots.set(gameId, snapshot);
        }
    }
    createGame(gameName, maxPlayers, scenario, firstPlayer) {
        const gameId = generateId();
        // Read fresh config from .env at runtime (not cached)
        const config = configManager.read();
        const engine = new GameEngine({ id: gameId, name: gameName, maxPlayers, scenario, players: [firstPlayer], npcs: [], chatHistory: [], events: [] }, config.llmBaseUrl, config.llmApiKey, config.llmModel);
        this.games.set(gameId, engine);
        console.log(`[GameStore] Created game "${gameName}" (ID: ${gameId}, scenario: ${scenario})`);
        return engine;
    }
    getGame(gameId) {
        return this.games.get(gameId);
    }
    joinGame(gameId, player) {
        const engine = this.games.get(gameId);
        if (!engine)
            throw new Error(`Game not found: ${gameId}`);
        if (engine.getPlayerCount() >= engine.getMaxPlayers())
            throw new Error("Game is full");
        engine.addPlayer(player);
    }
    listGames() {
        return Array.from(this.games.values()).map(e => ({
            id: e.id,
            name: e.name,
            scenario: e.game.scenario,
            players: e.getPlayerCount(),
            maxPlayers: e.getMaxPlayers(),
        }));
    }
    deleteGame(gameId) {
        const deleted = this.games.delete(gameId);
        if (deleted)
            console.log(`[GameStore] Deleted game: ${gameId}`);
        return deleted;
    }
    cleanupEmptyGames(olderThanMs = 3600000) {
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
    getGameCount() {
        return this.games.size;
    }
}
export const gameStore = new GameStore();
//# sourceMappingURL=store.js.map