import { type LLMCallbacks } from "../llm/client.js";
import type { Game, Player, PlayerActionPayload, StreamResult } from "../types/index.js";
export declare class GameEngine {
    private _game;
    private llmClient;
    private _currentInitiativeIndex;
    private _round;
    private _storySummary;
    private _turnCount;
    private readonly SUMMARY_INTERVAL;
    constructor(gameData: Omit<Game, "createdAt" | "conversationHistory">, llmBaseUrl: string, llmApiKey: string | null, llmModel: string);
    get game(): Game;
    get id(): string;
    get name(): string;
    startInitiative(): void;
    getCurrentPlayer(): Player | undefined;
    advanceTurn(): void;
    /**
     * Build a compact world state string (~100 tokens) that gives the DM
     * current game state without repeating full player stats every turn.
     */
    private buildWorldState;
    /**
     * Update the story summary by asking LLM to condense recent events.
     * This gives the DM a "big picture" understanding of the adventure.
     * Called every SUMMARY_INTERVAL turns.
     */
    private updateStorySummary;
    handlePlayerAction(payload: PlayerActionPayload, playerId: string, callbacks: LLMCallbacks): Promise<StreamResult>;
    private handleShortRest;
    generateOpeningScene(callbacks: LLMCallbacks): Promise<StreamResult>;
    addChatMessage(playerId: string, content: string): void;
    addNPC(name: string, description: string, role: "friendly" | "neutral" | "hostile"): void;
    addEvent(title: string, description: string): void;
    getPlayerCount(): number;
    getMaxPlayers(): number;
    getCreatedAt(): number;
    addPlayer(player: Player): void;
}
//# sourceMappingURL=engine.d.ts.map