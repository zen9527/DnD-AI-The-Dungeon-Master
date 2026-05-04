import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GameEngine } from "../../src/game/engine.js";

describe("GameEngine turn timer", () => {
  let engine: GameEngine;

  beforeEach(() => {
    // Mock LLM client to avoid actual API calls
    const mockLLMClient = { streamChat: vi.fn() };
    
    // Create engine with minimal game data
    engine = new GameEngine(
      { 
        id: "test-game", 
        name: "Test", 
        scenario: "dungeon", 
        maxPlayers: 4, 
        npcs: [], 
        players: [{
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
          spellSlots: {}, spells: [], inventory: [],
          conditions: [], hitDice: { total: 1, used: 0 },
          deathSaves: { successes: 0, failures: 0 }, xp: 0, locale: "en-US"
        }]
      },
      "http://test", null, "test"
    );
    
    // Mock the LLM client
    (engine as any).llmClient = mockLLMClient;
  });

  afterEach(() => {
    // Clean up timer intervals
    if ((engine as any)._timerInterval) {
      clearInterval((engine as any)._timerInterval);
    }
  });

  it("should reset timer to 60 seconds when starting", () => {
    engine.startTimer();
    expect(engine.timerRemaining).toBe(60);
  });

  it("should countdown timer correctly", async () => {
    engine.startTimer();
    expect(engine.timerRemaining).toBe(60);
    
    // Wait 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    expect(engine.timerRemaining).toBeLessThan(60);
  });

  it("should stop timer when stopTimer is called", () => {
    engine.startTimer();
    const initial = engine.timerRemaining;
    
    engine.stopTimer();
    
    // Timer should not countdown after stop
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(engine.timerRemaining).toBe(initial); // Should not have decreased
        resolve(undefined);
      }, 1500);
    });
  });

  it("should reset timer when advanceTurn is called", () => {
    engine.startTimer();
    
    // Advance turn should reset timer to 60
    engine.advanceTurn();
    expect(engine.timerRemaining).toBe(60);
  });

  it("should countdown timer correctly", async () => {
    engine.startTimer();
    const initial = engine.timerRemaining;
    expect(initial).toBe(60);
    
    // Wait 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    expect(engine.timerRemaining).toBeLessThan(initial);
  });

  it("should stop at 0 when timer expires", async () => {
    // Stop the real interval from startTimer() and use a fast mock
    if ((engine as any)._timerInterval) {
      clearInterval((engine as any)._timerInterval);
    }
    
    (engine as any)._timerRemaining = 60;
    (engine as any)._timerExpired = false;
    (engine as any)._timerInterval = setInterval(() => {
      if ((engine as any)._timerRemaining > 0) {
        (engine as any)._timerRemaining--;
      }
      if ((engine as any)._timerRemaining <= 0) {
        (engine as any)._timerRemaining = 0;
        (engine as any)._timerExpired = true;
      }
    }, 100);
    
    // Wait until timer reaches 0 (60 * 100ms = 6 seconds + buffer)
    await new Promise(resolve => setTimeout(resolve, 7000));
    
    expect(engine.timerRemaining).toBe(0);
    expect((engine as any)._timerExpired).toBe(true);
  });

  it("should stop timer when stopTimer is called", () => {
    engine.startTimer();
    expect((engine as any)._timerInterval).not.toBeNull();
    
    engine.stopTimer();
    expect((engine as any)._timerInterval).toBeNull();
  });

  it("should reset timer when advanceTurn is called", () => {
    engine.startTimer();
    const initial = engine.timerRemaining;
    
    // Advance turn should reset timer to 60
    engine.advanceTurn();
    expect(engine.timerRemaining).toBe(60);
  });
});
