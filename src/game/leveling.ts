import type { Game, Player } from "../types/index.js";
import { calculateModifier, calculateProficiencyBonus } from "./dice.js";
import { checkLevelUp } from "./rules.js";
import { HIT_DIE_BY_CLASS } from "../../shared/schemas/game.js";
import type { GameState } from "./game-state.js";

const DEFAULT_HIT_DIE = 8;

/** Experience points and level progression. */
export class LevelingService {
  constructor(private readonly state: GameState) {}

  private hitDie(player: Player): number {
    return HIT_DIE_BY_CLASS[player.characterClass] || DEFAULT_HIT_DIE;
  }

  /**
   * Grant XP and level up immediately if the new total crosses a threshold.
   * A single award can only advance one level, matching the D&D 5e convention
   * that levelling is a deliberate step rather than an automatic cascade.
   */
  awardXP(playerId: string, amount: number): void {
    this.state.mutate(game => {
      const player = game.players.find(p => p.id === playerId);
      if (!player) return;

      player.xp += amount;
      if (checkLevelUp(player.xp, player.level).shouldLevelUp) {
        this.applyLevelUp(player);
      }
    });
  }

  /** Award the same XP to the whole party (e.g. a shared encounter). */
  awardXPToAll(amount: number): void {
    this.state.mutate(game => {
      for (const player of game.players) {
        player.xp += amount;
        if (checkLevelUp(player.xp, player.level).shouldLevelUp) {
          this.applyLevelUp(player);
        }
      }
    });
  }

  levelUp(playerId: string): void {
    this.state.mutate(game => {
      const player = game.players.find(p => p.id === playerId);
      if (player) this.applyLevelUp(player);
    });
  }

  /** Reset a character to level 1 with no experience. */
  resetXP(playerId: string): void {
    this.state.mutate((game: Game) => {
      const player = game.players.find(p => p.id === playerId);
      if (!player) return;

      player.xp = 0;
      player.level = 1;
      player.proficiencyBonus = calculateProficiencyBonus(1);
      player.maxHp = this.hitDie(player) + calculateModifier(player.attributes.con);
      player.hp = player.maxHp;
    });
  }

  /**
   * Raise a level in place: average hit-die roll + CON modifier of max HP
   * (minimum 1), healed on the spot, and a recomputed proficiency bonus.
   */
  private applyLevelUp(player: Player): void {
    player.level++;

    const conMod = calculateModifier(player.attributes.con);
    const hpIncrease = Math.max(1, Math.floor(this.hitDie(player) / 2) + 1 + conMod);
    player.maxHp += hpIncrease;
    player.hp += hpIncrease;

    player.proficiencyBonus = calculateProficiencyBonus(player.level);
  }
}
