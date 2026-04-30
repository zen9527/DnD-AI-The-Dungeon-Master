import type { Game, Player, ChatMessage, NPC, StructuredResult, StreamResult } from "../../shared/index.js";
import { parseLLMResponse } from "@llm/parser.js";

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

  /**
   * Get the parsed narrative from current stream buffer (strips JSON block)
   */
  getParsedNarrative(): string {
    if (!this._streamBuffer) return "";
    const parsed = parseLLMResponse(this._streamBuffer);
    return parsed.fullNarrative;
  }

  applyStreamResult(result: StreamResult): void {
    if (this._game) {
      // Update player HP
      if (result.structured.playerHp && this._currentPlayer) {
        this._currentPlayer.hp = result.structured.playerHp.after;
      }
      
      // Update creature HP
      if (result.structured.creatureHp) {
        const npc = this._game.npcs.find((n: NPC) => n.name === result.structured.creatureHp!.name);
        if (npc) npc.hp = result.structured.creatureHp!.after;
      }
      
      // Remove defeated creatures from NPC list
      if (result.structured.creatureDefeated && result.structured.creatureHp) {
        this._game.npcs = this._game.npcs.filter(
          (n: NPC) => n.name !== result.structured.creatureHp!.name
        );
      }
      
      // Add new NPCs from DM response to game state
      if (result.structured.newNPCs) {
        this._game.npcs.push(...result.structured.newNPCs);
      }
      
      // Add newly learned spells to current player's spell list
      if (result.structured.newSpells && result.structured.newSpells.length > 0) {
        const player = this._game.players.find(p => p.id === this._currentPlayer?.id);
        if (player) {
          for (const spell of result.structured.newSpells) {
            // Avoid duplicates — only add if not already known
            const exists = player.spells?.some(s => s.name.toLowerCase() === spell.name.toLowerCase());
            if (!exists && !player.spells) {
              player.spells = [];
            }
            if (player.spells && !player.spells.some(s => s.name.toLowerCase() === spell.name.toLowerCase())) {
              player.spells.push({ name: spell.name, level: spell.level });
            }
          }
        }
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
