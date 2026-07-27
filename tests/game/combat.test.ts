import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GameEngine } from "../../src/game/engine.js";
import type { Player } from "../../src/types/index.js";

function testPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player1",
    name: "Test Player",
    characterName: "Hero",
    isDM: true,
    race: "Human",
    characterClass: "Fighter",
    level: 1,
    attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    hp: 10, maxHp: 20, ac: 11,
    proficiencyBonus: 2,
    spellSlots: {}, spells: [], inventory: [], usedItems: [],
    conditions: [], buffs: [], hitDice: { total: 1, used: 0 },
    deathSaves: { successes: 0, failures: 0 }, xp: 0, locale: "en-US",
    ...overrides,
  };
}

function testEngine(players: Player[]): GameEngine {
  return new GameEngine(
    {
      id: "g1", name: "Test", scenario: "dungeon", maxPlayers: 4,
      players, npcs: [], chatHistory: [],
      combatMode: false, initiativeOrder: [], currentRound: 1, currentTurnIndex: 0,
    },
    { provider: "openai-compatible", baseUrl: "http://test", apiKey: null, model: "test" }
  );
}

describe("buff durations", () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = testEngine([testPlayer()]);
  });

  afterEach(() => {
    engine.stopTimer();
    vi.useRealTimers();
  });

  it("ticks down once per completed round, not once per turn", () => {
    engine.applyBuff("player1", true, { name: "Bless", effect: "+1d4", duration: 2 });

    // One player means every advanceTurn wraps the rotation, ending a round.
    engine.advanceTurn();

    expect(engine.game.players[0].buffs[0].duration).toBe(1);
  });

  it("removes a buff once its duration runs out", () => {
    engine.applyBuff("player1", true, { name: "Bless", effect: "+1d4", duration: 1 });

    engine.advanceTurn();

    expect(engine.game.players[0].buffs).toEqual([]);
  });

  it("leaves buffs alone on turns that do not end the round", () => {
    const engine2 = testEngine([testPlayer(), testPlayer({ id: "player2", isDM: false })]);
    engine2.applyBuff("player1", true, { name: "Bless", effect: "+1d4", duration: 3 });

    engine2.advanceTurn(); // player1 -> player2, round still in progress

    expect(engine2.game.players[0].buffs[0].duration).toBe(3);

    engine2.advanceTurn(); // wraps back to player1, round complete

    expect(engine2.game.players[0].buffs[0].duration).toBe(2);
    engine2.stopTimer();
  });

  it("expires temporary HP along with buffs", () => {
    engine.applyTemporaryHP("player1", true, 5, 1);
    expect(engine.game.players[0].temporaryHp).toBe(5);

    engine.advanceTurn();

    expect(engine.game.players[0].temporaryHp).toBeUndefined();
    expect(engine.game.players[0].temporaryHpRemaining).toBeUndefined();
  });

  it("keeps the stronger pool when temporary HP is reapplied", () => {
    engine.applyTemporaryHP("player1", true, 8, 3);
    engine.applyTemporaryHP("player1", true, 4, 3);

    expect(engine.game.players[0].temporaryHp).toBe(8);
  });

  it("refreshes a buff of the same name rather than stacking it", () => {
    engine.applyBuff("player1", true, { name: "Bless", effect: "+1d4", duration: 2 });
    engine.applyBuff("player1", true, { name: "Bless", effect: "+1d4", duration: 10 });

    const buffs = engine.game.players[0].buffs;
    expect(buffs).toHaveLength(1);
    expect(buffs[0].duration).toBe(10);
  });
});
