import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GameEngine } from "../../src/game/engine.js";
import { TurnTimer } from "../../src/game/combat.js";
import { calculateCombinedCheck } from "../../src/game/rules.js";
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
    hp: 10, maxHp: 10, ac: 11,
    proficiencyBonus: 2,
    spellSlots: {}, spells: [], inventory: [], usedItems: [],
    conditions: [], buffs: [], hitDice: { total: 1, used: 0 },
    deathSaves: { successes: 0, failures: 0 }, xp: 0, locale: "en-US",
    ...overrides,
  };
}

function testEngine(players: Player[] = [testPlayer()]): GameEngine {
  return new GameEngine(
    { id: "test-game", name: "Test", scenario: "dungeon", maxPlayers: 4, npcs: [], players, chatHistory: [], events: [], combatMode: false, initiativeOrder: [], currentRound: 1, currentTurnIndex: 0 },
    { provider: "openai-compatible", baseUrl: "http://test", apiKey: null, model: "test" }
  );
}

describe("TurnTimer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts at 60 seconds", () => {
    const timer = new TurnTimer();
    timer.start();
    expect(timer.remaining).toBe(60);
    expect(timer.expired).toBe(false);
    timer.stop();
  });

  it("counts down one second at a time", () => {
    const timer = new TurnTimer();
    timer.start();

    vi.advanceTimersByTime(3000);

    expect(timer.remaining).toBe(57);
    timer.stop();
  });

  it("stops at 0 and reports expiry exactly once", () => {
    const onExpire = vi.fn();
    const timer = new TurnTimer(onExpire);
    timer.start();

    vi.advanceTimersByTime(65000);

    expect(timer.remaining).toBe(0);
    expect(timer.expired).toBe(true);
    expect(onExpire).toHaveBeenCalledTimes(1);
    timer.stop();
  });

  it("does not count down after stop()", () => {
    const timer = new TurnTimer();
    timer.start();
    timer.stop();

    vi.advanceTimersByTime(5000);

    expect(timer.remaining).toBe(60);
  });

  it("restarts from the top on a fresh start()", () => {
    const timer = new TurnTimer();
    timer.start();
    vi.advanceTimersByTime(10000);
    expect(timer.remaining).toBe(50);

    timer.start();

    expect(timer.remaining).toBe(60);
    expect(timer.expired).toBe(false);
    timer.stop();
  });
});

describe("GameEngine turn timer", () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = testEngine();
  });

  afterEach(() => {
    engine.stopTimer();
    vi.useRealTimers();
  });

  it("exposes the countdown through timerRemaining", () => {
    engine.startTimer();
    expect(engine.timerRemaining).toBe(60);

    vi.advanceTimersByTime(2000);

    expect(engine.timerRemaining).toBe(58);
  });

  it("resets the countdown when the turn advances", () => {
    engine.startTimer();
    vi.advanceTimersByTime(20000);
    expect(engine.timerRemaining).toBe(40);

    engine.advanceTurn();

    expect(engine.timerRemaining).toBe(60);
  });

  it("freezes the countdown after stopTimer", () => {
    engine.startTimer();
    engine.stopTimer();

    vi.advanceTimersByTime(5000);

    expect(engine.timerRemaining).toBe(60);
  });
});

describe("GameEngine state snapshot", () => {
  it("reflects mutations immediately after a previous read", () => {
    const engine = testEngine();

    // Prime the snapshot cache, then mutate — the next read must not be stale.
    expect(engine.game.npcs).toHaveLength(0);
    engine.addNPC("Goblin", "A snarling goblin", "hostile");

    expect(engine.game.npcs).toHaveLength(1);
    expect(engine.game.npcs[0].name).toBe("Goblin");
  });

  it("sees new chat messages right after adding them", () => {
    const engine = testEngine();

    expect(engine.game.chatHistory).toHaveLength(0);
    engine.addEvent("Player Joined", "Hero has joined the adventure");

    const latest = engine.game.chatHistory[engine.game.chatHistory.length - 1];
    expect(latest.content).toContain("Hero has joined the adventure");
  });

  it("hands out copies that cannot corrupt the live state", () => {
    const engine = testEngine();
    engine.addNPC("Goblin", "A snarling goblin", "hostile");

    engine.game.npcs[0].hp = 999;
    // Force a fresh snapshot; the live NPC should be untouched by the write above.
    engine.addEvent("Tick", "unrelated mutation");

    expect(engine.game.npcs[0].hp).toBe(10);
  });

  it("applies a locale change to the live game", () => {
    const engine = testEngine();

    expect(engine.setPlayerLocale("player1", "zh-CN")).toBe(true);

    expect(engine.game.players[0].locale).toBe("zh-CN");
  });
});

describe("calculateCombinedCheck", () => {
  it("should add +2 per additional helper", () => {
    const mainRoll = 15;
    const mainMod = 3;
    const helpers = 2; // 2 other players helping
    
    const result = calculateCombinedCheck(mainRoll, mainMod, helpers);
    // Main: 15 + 3 = 18, Helpers: +2 each = +4, Total: 22
    expect(result.total).toBe(22);
    expect(result.helperBonus).toBe(4);
  });

  it("should handle zero helpers (regular check)", () => {
    const result = calculateCombinedCheck(12, 5, 0);
    expect(result.total).toBe(17);
    expect(result.helperBonus).toBe(0);
  });

  it("should default DC to 15", () => {
    const result = calculateCombinedCheck(10, 2, 1);
    expect(result.dc).toBe(15);
    expect(result.success).toBe(false); // 10 + 2 + 2 = 14 < 15
  });

  it("should handle non-proficient helpers (no bonus)", () => {
    const result = calculateCombinedCheck(10, 2, 2, false);
    expect(result.helperBonus).toBe(0);
    expect(result.total).toBe(12); // No helper bonus when not proficient
  });

  it("should succeed with enough helpers", () => {
    const result = calculateCombinedCheck(8, 3, 3);
    // Main: 8 + 3 = 11, Helpers: 3 * 2 = 6, Total: 17 >= 15
    expect(result.total).toBe(17);
    expect(result.success).toBe(true);
  });
});
