import type { InitiativeEntry, NPC, Player } from "../types/index.js";
import { buildInitiativeOrder, calculateInitiative } from "./rules.js";
import { getLocalizedMessage } from "../utils/locale-loader.js";
import type { GameState } from "./game-state.js";

const DEFAULT_TURN_SECONDS = 60;

/** Buff/debuff payload shared by players and NPCs. */
export interface Buff {
  name: string;
  effect: string;
  bonus?: number;
  duration: number;
}

/**
 * Counts down the seconds left in the active turn.
 *
 * The engine does not push updates itself — `WebSocketManager` polls
 * `remaining`/`expired` on an interval and broadcasts to clients.
 */
export class TurnTimer {
  private remainingSeconds = DEFAULT_TURN_SECONDS;
  private interval: NodeJS.Timeout | null = null;
  private hasExpired = false;

  constructor(private readonly onExpire?: () => void) {}

  get remaining(): number {
    return this.remainingSeconds;
  }

  get expired(): boolean {
    return this.hasExpired;
  }

  /** Restart the countdown from the top; safe to call on every turn change. */
  start(): void {
    this.stop();
    this.remainingSeconds = DEFAULT_TURN_SECONDS;
    this.hasExpired = false;

    this.interval = setInterval(() => {
      if (this.remainingSeconds > 0) this.remainingSeconds--;
      if (this.remainingSeconds <= 0 && !this.hasExpired) {
        this.remainingSeconds = 0;
        this.hasExpired = true;
        this.onExpire?.();
      }
    }, 1000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

/**
 * Initiative, turn order, NPC status, and buff durations.
 *
 * Turn advancement has two modes: in combat it walks the rolled initiative
 * order; outside combat it round-robins the party (and any NPCs present) so
 * the turn timer still has someone to point at.
 */
export class CombatService {
  /** Cursor into the non-combat rotation, which has no initiative order. */
  private rotationIndex = 0;

  constructor(
    private readonly state: GameState,
    readonly timer: TurnTimer
  ) {
    this.rotationIndex = 0;
  }

  get combatMode(): boolean {
    return this.state.raw.combatMode;
  }

  get initiativeOrder(): InitiativeEntry[] {
    return this.state.raw.initiativeOrder;
  }

  get round(): number {
    return this.state.raw.currentRound;
  }

  get currentTurnIndex(): number {
    return this.state.raw.currentTurnIndex;
  }

  /** DM narration language, taken from the game's creator. */
  private get locale(): string {
    return this.state.raw.players?.[0]?.locale || "en-US";
  }

  /**
   * Enter combat. With `rollInitiative` the whole table rolls and the order is
   * announced in the conversation history; without it the DM will call for
   * individual rolls via `rollIndividualInitiative`.
   */
  startCombat(rollInitiative: boolean = true): void {
    this.state.mutate(game => {
      game.combatMode = true;
      this.rotationIndex = 0;
      game.currentRound = 1;
      game.currentTurnIndex = 0;

      if (!rollInitiative) {
        game.initiativeOrder = [];
        return;
      }

      const rolled = buildInitiativeOrder(game.players, game.npcs);

      game.initiativeOrder = rolled.map(entry => {
        const isPlayer = !!entry.playerId;
        const entity = isPlayer
          ? game.players.find(p => p.id === entry.playerId)
          : game.npcs.find(n => n.id === entry.npcId);

        if (entity) entity.initiative = entry.score;

        return {
          playerId: entry.playerId,
          npcId: entry.npcId,
          score: entry.score,
          name: isPlayer
            ? (entity as Player)?.characterName || "Unknown Player"
            : (entity as NPC)?.name || "Unknown NPC",
          hp: entity?.hp || 0,
          maxHp: entity?.maxHp || 0,
          ac: entity?.ac || 10,
          isPlayer,
        };
      });

      const roster = game.initiativeOrder.map((entry, i) => `${i + 1}. ${entry.name} (${entry.score})`).join("\n");
      game.conversationHistory.push({
        role: "assistant",
        content: `${getLocalizedMessage(this.locale, "initiative.rolled")}\n${roster}`,
      });
    });
  }

  /** Leave combat, clearing initiative scores but keeping NPCs on the board. */
  endCombat(): void {
    this.state.mutate(game => {
      game.combatMode = false;
      game.players.forEach(p => delete p.initiative);
      game.initiativeOrder = [];
      this.rotationIndex = 0;
      game.currentRound = 1;
      game.currentTurnIndex = 0;

      game.conversationHistory.push({
        role: "assistant",
        content: getLocalizedMessage(this.locale, "combat.ended"),
      });
    });
  }

  /** Roll initiative for a single combatant and splice them into the order. */
  rollIndividualInitiative(entityId: string, isPlayer: boolean): number {
    return this.state.mutate(game => {
      const entity: Player | NPC | undefined = isPlayer
        ? game.players.find(p => p.id === entityId)
        : game.npcs.find(n => n.id === entityId);

      const score = calculateInitiative(entity?.attributes.dex ?? 10);
      if (!entity) return score;

      entity.initiative = score;
      game.initiativeOrder.push({
        playerId: isPlayer ? entityId : undefined,
        npcId: isPlayer ? undefined : entityId,
        score,
        name: isPlayer ? (entity as Player).characterName : (entity as NPC).name,
        hp: entity.hp,
        maxHp: entity.maxHp,
        ac: entity.ac,
        isPlayer,
      });
      game.initiativeOrder.sort((a, b) => b.score - a.score);

      return score;
    });
  }

  /**
   * Hand the turn to the next combatant and restart the countdown.
   *
   * Outside combat only players are in the rotation — NPCs act when the DM
   * narrates them, not on a clock.
   */
  advanceTurn(): void {
    this.state.mutate(game => {
      if (!game.combatMode || game.initiativeOrder.length === 0) {
        if (game.players.length === 0) return;
        this.rotationIndex = (this.rotationIndex + 1) % game.players.length;
        if (this.rotationIndex === 0) game.currentRound++;
        return;
      }

      game.currentTurnIndex = (game.currentTurnIndex + 1) % game.initiativeOrder.length;
      if (game.currentTurnIndex === 0) game.currentRound++;
    });

    this.timer.start();
  }

  /**
   * The player whose turn it is, or undefined when an NPC holds the initiative
   * slot. Returns the live record so callers see current HP.
   */
  getCurrentPlayer(): Player | undefined {
    const game = this.state.raw;

    if (!game.combatMode || game.initiativeOrder.length === 0) {
      if (game.players.length === 0) return undefined;
      return game.players[this.rotationIndex % game.players.length];
    }

    const entry = game.initiativeOrder[game.currentTurnIndex];
    if (!entry?.playerId) return undefined;
    return game.players.find(p => p.id === entry.playerId);
  }

  /** The initiative entry holding the turn, player or NPC. */
  getCurrentCombatEntity(): InitiativeEntry | undefined {
    const game = this.state.raw;
    if (!game.combatMode || game.initiativeOrder.length === 0) return undefined;
    return game.initiativeOrder[game.currentTurnIndex];
  }

  // ---- NPC status ----

  /** Set an NPC's current HP, keeping the initiative row in sync. */
  updateNPCHP(npcId: string, newHp: number): void {
    this.state.mutate(game => {
      const npc = game.npcs.find(n => n.id === npcId);
      if (!npc) return;

      npc.hp = Math.max(0, newHp);
      const entry = game.initiativeOrder.find(e => e.npcId === npcId);
      if (entry) {
        entry.hp = npc.hp;
        entry.maxHp = npc.maxHp;
      }
    });
  }

  applyConditionToNPC(npcId: string, condition: string): void {
    this.state.mutate(game => {
      const npc = game.npcs.find(n => n.id === npcId);
      if (npc && !npc.conditions.includes(condition)) npc.conditions.push(condition);
    });
  }

  removeConditionFromNPC(npcId: string, condition: string): void {
    this.state.mutate(game => {
      const npc = game.npcs.find(n => n.id === npcId);
      if (npc) npc.conditions = npc.conditions.filter(c => c !== condition);
    });
  }

  // ---- Buffs & temporary HP ----

  /** Look up a player or NPC by id, throwing if the caller named a ghost. */
  private findEntity(game: { players: Player[]; npcs: NPC[] }, targetId: string, isPlayer: boolean): Player | NPC {
    const entity = isPlayer
      ? game.players.find(p => p.id === targetId)
      : game.npcs.find(n => n.id === targetId);
    if (!entity) throw new Error(`${isPlayer ? "Player" : "NPC"} not found: ${targetId}`);
    return entity;
  }

  /** Temporary HP does not stack — the larger pool wins, as in D&D 5e. */
  applyTemporaryHP(targetId: string, isPlayer: boolean, amount: number, duration: number): void {
    this.state.mutate(game => {
      const entity = this.findEntity(game, targetId, isPlayer);
      entity.temporaryHp = Math.max(entity.temporaryHp || 0, amount);
      entity.temporaryHpRemaining = duration;
    });
  }

  /** Apply a buff, refreshing it if one with the same name is already active. */
  applyBuff(targetId: string, isPlayer: boolean, buff: Buff): void {
    this.state.mutate(game => {
      const entity = this.findEntity(game, targetId, isPlayer);
      const buffs = entity.buffs || [];
      const existing = buffs.findIndex(b => b.name === buff.name);
      if (existing >= 0) {
        buffs[existing] = buff;
      } else {
        buffs.push(buff);
      }
      entity.buffs = buffs;
    });
  }

  removeBuff(targetId: string, isPlayer: boolean, buffName: string): void {
    this.state.mutate(game => {
      const entity = this.findEntity(game, targetId, isPlayer);
      if (!entity.buffs) return;
      entity.buffs = entity.buffs.filter(b => b.name !== buffName);
    });
  }

  /** Tick every buff and temporary-HP pool down one round, dropping expired ones. */
  reduceBuffDurations(): void {
    this.state.mutate(game => {
      for (const entity of [...game.players, ...game.npcs]) {
        if (entity.buffs) {
          entity.buffs = entity.buffs.filter(b => --b.duration > 0);
        }

        if (entity.temporaryHpRemaining !== undefined) {
          entity.temporaryHpRemaining--;
          if (entity.temporaryHpRemaining <= 0) {
            entity.temporaryHp = undefined;
            entity.temporaryHpRemaining = undefined;
          }
        }
      }
    });
  }

  getPlayerBuffs(playerId: string): Buff[] {
    const player = this.state.raw.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");
    return player.buffs || [];
  }

  getNPCBuffs(npcId: string): Buff[] {
    const npc = this.state.raw.npcs.find(n => n.id === npcId);
    if (!npc) throw new Error("NPC not found");
    return npc.buffs || [];
  }
}
