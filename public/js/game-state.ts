import type { Game, Player, ChatMessage, InitiativeEntry } from "../../shared/index.js";
import { parseLLMResponse } from "../../shared/utils/parseLLMResponse.js";

interface GameStateListener {
  (state: { 
    game: Game | null; 
    currentPlayer: Player | null; 
    timerState: { remaining: number; currentPlayerId: string; expired?: boolean } | null;
    combatMode: boolean;
    initiativeOrder: InitiativeEntry[];
    currentRound: number;
    currentTurnIndex: number;
    currentPlayerName?: string;
  }): void;
}

export class GameState {
  private _game: Game | null = null;
  private _currentPlayer: Player | null = null;
  private _streamBuffer = "";
  private _timerState: { remaining: number; currentPlayerId: string; expired?: boolean } | null = null;
  private _combatMode: boolean = false;
  private _initiativeOrder: InitiativeEntry[] = [];
  private _currentRound: number = 1;
  private _currentTurnIndex: number = 0;
  private _currentPlayerName: string | undefined = undefined;
  private listeners: GameStateListener[] = [];

  get game(): Game | null { return this._game; }
  get currentPlayer(): Player | null { return this._currentPlayer; }
  get streamBuffer(): string { return this._streamBuffer; }
  get timerState(): { remaining: number; currentPlayerId: string; expired?: boolean } | null { return this._timerState; }
  get combatMode(): boolean { return this._combatMode; }
  get initiativeOrder(): InitiativeEntry[] { return this._initiativeOrder; }
  get currentRound(): number { return this._currentRound; }
  get currentTurnIndex(): number { return this._currentTurnIndex; }
  get currentPlayerName(): string | undefined { return this._currentPlayerName; }

  setGame(gameData: Game): void {
    this._game = gameData;
    this.notifyListeners();
  }

  setCurrentPlayer(playerData: Player): void {
    this._currentPlayer = playerData;
    this.notifyListeners();
  }

  addChatMessage(message: ChatMessage): void {
    if (this._game) {
      if (!this._game.chatHistory) this._game.chatHistory = [];
      this._game.chatHistory.push(message);
      this.notifyListeners();
    }
  }

  updateStreamBuffer(content: string): void {
    this._streamBuffer += content;
  }

  clearStreamBuffer(): void {
    this._streamBuffer = "";
  }

  setTimerState(state: { remaining: number; currentPlayerId: string; expired?: boolean }): void {
    this._timerState = state;
    this.notifyListeners();
  }

  setCombatState(state: { 
    combatMode: boolean;
    initiativeOrder: InitiativeEntry[];
    currentRound: number;
    currentTurnIndex: number;
    currentPlayerName?: string;
  }): void {
    this._combatMode = state.combatMode;
    this._initiativeOrder = state.initiativeOrder || [];
    this._currentRound = state.currentRound || 1;
    this._currentTurnIndex = state.currentTurnIndex || 0;
    this._currentPlayerName = state.currentPlayerName;
    this.notifyListeners();
  }

  setInitiativeOrder(order: InitiativeEntry[]): void {
    this._initiativeOrder = order;
    this.notifyListeners();
  }

  /**
   * Get the parsed narrative from current stream buffer (strips JSON block)
   */
  getParsedNarrative(): string {
    if (!this._streamBuffer) return "";
    const parsed = parseLLMResponse(this._streamBuffer);
    return parsed.fullNarrative;
  }

  subscribe(callback: GameStateListener): () => void {
    this.listeners.push(callback);
    callback({
      game: this._game,
      currentPlayer: this._currentPlayer,
      timerState: this._timerState,
      combatMode: this._combatMode,
      initiativeOrder: this._initiativeOrder,
      currentRound: this._currentRound,
      currentTurnIndex: this._currentTurnIndex,
      currentPlayerName: this._currentPlayerName,
    });
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback({ 
      game: this._game, 
      currentPlayer: this._currentPlayer, 
      timerState: this._timerState,
      combatMode: this._combatMode,
      initiativeOrder: this._initiativeOrder,
      currentRound: this._currentRound,
      currentTurnIndex: this._currentTurnIndex,
      currentPlayerName: this._currentPlayerName
    }));
  }

  clear(): void {
    this._game = null;
    this._currentPlayer = null;
    this._streamBuffer = "";
    this._timerState = null;
    this._combatMode = false;
    this._initiativeOrder = [];
    this._currentRound = 1;
    this._currentTurnIndex = 0;
    this._currentPlayerName = undefined;
    this.notifyListeners();
  }
}

export const gameState = new GameState();
