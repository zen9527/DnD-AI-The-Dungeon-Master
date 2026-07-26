import { generateId } from "../utils/id.js";
import { createLLMClient, type LLMCallbacks, type LLMConfig } from "../llm/client.js";
import { buildSystemPrompt } from "../llm/prompts.js";
import type {
  ChatMessage,
  Game,
  InitiativeEntry,
  Item,
  NPC,
  Player,
  PlayerActionPayload,
  StreamResult,
} from "../types/index.js";
import { type Scenario } from "../../shared/schemas/scenario.js";
import * as storage from "../utils/storage.js";
import { GameState } from "./game-state.js";
import { CombatService, TurnTimer, type Buff } from "./combat.js";
import { InventoryService } from "./inventory.js";
import { LevelingService } from "./leveling.js";
import { LLMInteractionService } from "./llm-interaction.js";

/** Chat log is trimmed to this many messages to bound memory and save size. */
const MAX_CHAT_HISTORY = 100;

const DEFAULT_NPC_STATS = { hp: 10, maxHp: 10, ac: 11 } as const;
const DEFAULT_NPC_ATTRIBUTES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const;

/**
 * One running game.
 *
 * The engine owns the game state and the turn timer, and handles the things
 * that do not belong to any one subsystem — chat, NPCs, events, persistence.
 * Everything else is delegated to a service that shares the same `GameState`:
 *
 * - `CombatService` — initiative, turns, NPC status, buffs
 * - `InventoryService` — items, equipment, consumables
 * - `LevelingService` — XP and levels
 * - `LLMInteractionService` — prompts, streaming, applying the DM's results
 *
 * The delegating methods below are the stable public surface used by the
 * WebSocket handlers and the game store.
 */
export class GameEngine {
  private readonly state: GameState;
  private readonly timer: TurnTimer;
  private readonly combat: CombatService;
  private readonly inventory: InventoryService;
  private readonly leveling: LevelingService;
  private readonly narration: LLMInteractionService;

  constructor(
    gameData: Omit<Game, "createdAt" | "conversationHistory"> & Partial<Pick<Game, "createdAt" | "conversationHistory">>,
    llmConfig: LLMConfig
  ) {
    this.state = new GameState({
      ...gameData,
      createdAt: gameData.createdAt ?? Date.now(),
      conversationHistory: [],
      combatMode: gameData.combatMode ?? false,
      initiativeOrder: gameData.initiativeOrder ?? [],
      currentRound: gameData.currentRound ?? 1,
      currentTurnIndex: gameData.currentTurnIndex ?? 0,
    });

    this.timer = new TurnTimer(() => {
      console.log(`[Timer] Turn timer expired for ${this.getCurrentPlayer()?.characterName}`);
    });

    this.combat = new CombatService(this.state, this.timer);
    this.inventory = new InventoryService(this.state);
    this.leveling = new LevelingService(this.state);
    this.narration = new LLMInteractionService(this.state, createLLMClient(llmConfig), this.combat);

    // The DM narrates in the creator's language until someone changes it.
    const creatorLocale = this.state.raw.players?.[0]?.locale || "en-US";
    this.setSystemPrompt(buildSystemPrompt((this.state.raw.scenario as Scenario) || "dungeon", creatorLocale));
  }

  /** An isolated copy of the game state, cached until the next mutation. */
  get game(): Game {
    return this.state.snapshot;
  }

  get id(): string { return this.state.raw.id; }
  get name(): string { return this.state.raw.name; }

  // ---- Turn timer ----

  get timerRemaining(): number { return this.timer.remaining; }
  get timerExpired(): boolean { return this.timer.expired; }

  startTimer(): void { this.timer.start(); }
  stopTimer(): void { this.timer.stop(); }

  // ---- Combat ----

  get combatMode(): boolean { return this.combat.combatMode; }
  get initiativeOrder(): InitiativeEntry[] { return this.combat.initiativeOrder; }
  get currentRound(): number { return this.combat.round; }
  get currentTurnIndex(): number { return this.combat.currentTurnIndex; }

  startCombat(startInitiative: boolean = true): void { this.combat.startCombat(startInitiative); }
  endCombat(): void { this.combat.endCombat(); }
  rollIndividualInitiative(entityId: string, isPlayer: boolean): number {
    return this.combat.rollIndividualInitiative(entityId, isPlayer);
  }
  advanceTurn(): void { this.combat.advanceTurn(); }
  getCurrentPlayer(): Player | undefined { return this.combat.getCurrentPlayer(); }

  // ---- DM narration ----

  handlePlayerAction(payload: PlayerActionPayload, playerId: string, callbacks: LLMCallbacks): Promise<StreamResult> {
    return this.narration.handlePlayerAction(payload, playerId, callbacks);
  }

  generateOpeningScene(callbacks: LLMCallbacks): Promise<StreamResult> {
    return this.narration.generateOpeningScene(callbacks);
  }

  // ---- Chat & events ----

  addChatMessage(playerId: string, content: string): void {
    const player = this.state.raw.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");

    this.pushChatMessage({
      id: generateId(),
      playerId,
      playerName: player.name,
      characterName: player.characterName,
      content,
      type: "text",
      timestamp: Date.now(),
    });
  }

  addEvent(title: string, description: string): void {
    this.pushChatMessage({
      id: generateId(),
      content: `Event: ${title} — ${description}`,
      type: "event",
      timestamp: Date.now(),
    });
  }

  private pushChatMessage(message: ChatMessage): void {
    this.state.mutate(game => {
      game.chatHistory.push(message);
      if (game.chatHistory.length > MAX_CHAT_HISTORY) game.chatHistory.shift();
    });
  }

  // ---- NPCs ----

  /** Add a plain NPC with default stats. */
  addNPC(name: string, description: string, role: "friendly" | "neutral" | "hostile"): void {
    this.createNPC({ name, description, role, ...DEFAULT_NPC_STATS, attributes: { ...DEFAULT_NPC_ATTRIBUTES } });
  }

  /** Add an NPC with DM-specified stats. */
  createNPC(npcData: {
    name: string;
    description?: string;
    role: "friendly" | "neutral" | "hostile";
    hp: number;
    maxHp: number;
    ac: number;
    attributes: NPC["attributes"];
  }): void {
    this.state.mutate(game => {
      game.npcs.push({
        id: generateId(),
        name: npcData.name,
        description: npcData.description || "",
        role: npcData.role,
        hp: Math.max(0, npcData.hp),
        maxHp: Math.max(0, npcData.maxHp),
        ac: Math.max(0, npcData.ac),
        attributes: npcData.attributes,
        createdAt: Date.now(),
        conditions: [],
        buffs: [],
      });
    });
  }

  /** Remove an NPC, also dropping it from the initiative order. */
  deleteNPC(npcId: string): void {
    this.state.mutate(game => {
      const index = game.npcs.findIndex(n => n.id === npcId);
      if (index < 0) return;

      game.npcs.splice(index, 1);
      const initiativeIndex = game.initiativeOrder.findIndex(e => e.npcId === npcId);
      if (initiativeIndex >= 0) game.initiativeOrder.splice(initiativeIndex, 1);
    });
  }

  getAllNPCs(): NPC[] { return this.state.snapshot.npcs; }

  updateNPCHP(npcId: string, newHp: number): void { this.combat.updateNPCHP(npcId, newHp); }
  applyConditionToNPC(npcId: string, condition: string): void { this.combat.applyConditionToNPC(npcId, condition); }
  removeConditionFromNPC(npcId: string, condition: string): void { this.combat.removeConditionFromNPC(npcId, condition); }

  // ---- Players ----

  getAllPlayers(): Player[] { return this.state.snapshot.players; }
  getPlayerCount(): number { return this.state.raw.players.length; }
  getMaxPlayers(): number { return this.state.raw.maxPlayers; }
  getCreatedAt(): number { return this.state.raw.createdAt; }

  addPlayer(player: Player): void {
    this.state.mutate(game => { game.players.push(player); });
  }

  removePlayer(playerId: string): void {
    this.state.mutate(game => { game.players = game.players.filter(p => p.id !== playerId); });
  }

  /** Change a player's preferred language. Returns false if the player is gone. */
  setPlayerLocale(playerId: string, locale: string): boolean {
    return this.state.mutate(game => {
      const player = game.players.find(p => p.id === playerId);
      if (!player) return false;
      player.locale = locale;
      return true;
    });
  }

  /**
   * Replace the system prompt at the head of the conversation history.
   * Used when a player switches locale so the DM narrates in the new language.
   */
  setSystemPrompt(content: string): void {
    this.state.mutate(game => {
      const entry = { role: "system" as const, content };
      if (game.conversationHistory.length > 0) {
        game.conversationHistory[0] = entry;
      } else {
        game.conversationHistory.push(entry);
      }
    });
  }

  // ---- XP & levelling ----

  awardXPToPlayer(playerId: string, amount: number): void { this.leveling.awardXP(playerId, amount); }
  awardXPToAllPlayers(amount: number): void { this.leveling.awardXPToAll(amount); }
  levelUpPlayer(playerId: string): void { this.leveling.levelUp(playerId); }
  resetPlayerXP(playerId: string): void { this.leveling.resetXP(playerId); }

  // ---- Inventory & equipment ----

  addItemToInventory(playerId: string, item: Item): void { this.inventory.addItem(playerId, item); }
  removeItemFromInventory(playerId: string, itemId: string): void { this.inventory.removeItem(playerId, itemId); }
  equipItem(playerId: string, itemId: string, slot: "weapon" | "armor"): void { this.inventory.equip(playerId, itemId, slot); }
  unequipItem(playerId: string, slot: "weapon" | "armor"): void { this.inventory.unequip(playerId, slot); }
  getPlayerInventory(playerId: string): Item[] { return this.inventory.getInventory(playerId); }
  getEquippedItems(playerId: string): { weapon?: Item; armor?: Item } { return this.inventory.getEquipped(playerId); }
  calculateTotalWeight(playerId: string): number { return this.inventory.getTotalWeight(playerId); }

  useItem(playerId: string, itemId: string, targetId?: string): { healed: number; message: string } {
    return this.inventory.useItem(playerId, itemId, targetId);
  }

  useConsumable(playerId: string, itemId: string): { healed: number } {
    return { healed: this.inventory.useItem(playerId, itemId).healed };
  }

  // ---- Buffs ----

  applyTemporaryHP(targetId: string, isPlayer: boolean, amount: number, duration: number): void {
    this.combat.applyTemporaryHP(targetId, isPlayer, amount, duration);
  }
  applyBuff(targetId: string, isPlayer: boolean, buff: Buff): void { this.combat.applyBuff(targetId, isPlayer, buff); }
  removeBuff(targetId: string, isPlayer: boolean, buffName: string): void { this.combat.removeBuff(targetId, isPlayer, buffName); }

  // ---- Persistence ----

  saveGame(): void {
    storage.saveGame(this.state.raw);
  }
}
