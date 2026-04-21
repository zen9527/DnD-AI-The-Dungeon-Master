import type { Game, Player, ChatMessage, NPC, StructuredResult, StreamResult } from "../../shared/index.js";

interface GameStateListener {
  (state: { game: Game | null; currentPlayer: Player | null }): void;
}

export class GameState {
  private _game: Game | null = null;
  private _currentPlayer: Player | null = null;
  private _streamBuffer = "";
  private listeners: GameStateListener[] = [];

  get game(): Game | null { return this._game; }
  get currentPlayer(): Player | null { return this._currentPlayer; }
  get streamBuffer(): string { return this._streamBuffer; }

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

  applyStreamResult(result: StreamResult): void {
    if (this._game) {
      if (result.structured.playerHp && this._currentPlayer) {
        this._currentPlayer.hp = result.structured.playerHp.after;
      }
      if (result.structured.creatureHp) {
        const npc = this._game.npcs.find((n: NPC) => n.name === result.structured.creatureHp!.name);
        if (npc) npc.hp = result.structured.creatureHp!.after;
      }
      if (result.structured.creatureDefeated && result.structured.creatureHp) {
        this._game.npcs = this._game.npcs.filter(
          (n: NPC) => n.name !== result.structured.creatureHp!.name
        );
      }
      if (result.structured.newNPCs) {
        this._game.npcs.push(...result.structured.newNPCs);
      }
      this.notifyListeners();
    }
  }

  isDM(): boolean {
    return this._currentPlayer?.isDM ?? false;
  }

  subscribe(callback: GameStateListener): () => void {
    this.listeners.push(callback);
    callback({ game: this._game, currentPlayer: this._currentPlayer });
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback({ game: this._game, currentPlayer: this._currentPlayer }));
  }

  clear(): void {
    this._game = null;
    this._currentPlayer = null;
    this._streamBuffer = "";
    this.notifyListeners();
  }
}

export const gameState = new GameState();
