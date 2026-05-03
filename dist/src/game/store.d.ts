import { GameEngine } from "./engine.js";
import type { Player } from "../types/index.js";
export declare class GameStore {
    private games;
    private snapshots;
    private cleanupInterval;
    constructor();
    private startSnapshotTimer;
    private saveSnapshots;
    createGame(gameName: string, maxPlayers: number, scenario: string, firstPlayer: Player): GameEngine;
    getGame(gameId: string): GameEngine | undefined;
    joinGame(gameId: string, player: Player): void;
    listGames(): Array<{
        id: string;
        name: string;
        scenario: string;
        players: number;
        maxPlayers: number;
    }>;
    deleteGame(gameId: string): boolean;
    cleanupEmptyGames(olderThanMs?: number): number;
    getGameCount(): number;
}
export declare const gameStore: GameStore;
//# sourceMappingURL=store.d.ts.map