// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Game, InitiativeEntry, Item, Player } from "../../../shared/index.js";

const sent: Array<{ type: string; payload: Record<string, unknown> }> = [];

vi.mock("../../../public/js/websocket.js", () => ({
  wsManager: { send: (m: { type: string; payload: Record<string, unknown> }) => sent.push(m) },
}));

vi.mock("../../../public/js/i18n.js", () => ({
  t: (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${Object.values(params).join(",")}` : key,
  getLocalizedRaceName: (r: string) => r,
  getLocalizedClassName: (c: string) => c,
}));

const { gameState } = await import("../../../public/js/game-state.js");
const { CombatPanelView } = await import("../../../public/js/views/combat-panel.js");
const { InventoryPanelView } = await import("../../../public/js/views/inventory-panel.js");
const { PlayersPanelView } = await import("../../../public/js/views/players-panel.js");
const { ChatView, formatDiceResult } = await import("../../../public/js/views/chat.js");

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1", name: "Ana", characterName: "Ranulf", isDM: true,
    race: "Human", characterClass: "Fighter", level: 3,
    attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    hp: 6, maxHp: 12, ac: 11, proficiencyBonus: 2,
    spellSlots: {}, spells: [], inventory: [], usedItems: [],
    conditions: [], buffs: [], hitDice: { total: 1, used: 0 },
    deathSaves: { successes: 0, failures: 0 }, xp: 400, locale: "en-US",
    ...overrides,
  };
}

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: "g1", name: "Test", maxPlayers: 4, scenario: "dungeon",
    players: [player()], npcs: [], chatHistory: [], events: [],
    conversationHistory: [], createdAt: Date.now(),
    combatMode: false, initiativeOrder: [], currentRound: 1, currentTurnIndex: 0,
    ...overrides,
  };
}

const entry = (o: Partial<InitiativeEntry> = {}): InitiativeEntry => ({
  playerId: "p1", score: 18, name: "Ranulf", hp: 6, maxHp: 12, ac: 11, isPlayer: true, ...o,
});

const item = (o: Partial<Item> = {}): Item => ({
  id: "sword-1", name: "Longsword", type: "weapon", weight: 3,
  stats: { attackBonus: 2 }, ...o,
});

beforeEach(() => {
  sent.length = 0;
  gameState.clear();
});
afterEach(() => { document.body.innerHTML = ""; });

describe("CombatPanelView", () => {
  beforeEach(() => { document.body.innerHTML = `<div id="combat-panel" class="hidden"></div>`; });

  it("says so when initiative has not been rolled", () => {
    gameState.setGame(game());
    new CombatPanelView().render();

    expect(document.querySelector(".combat-empty")).not.toBeNull();
    expect(document.querySelectorAll(".initiative-entry")).toHaveLength(0);
  });

  it("renders the initiative order and marks whose turn it is", () => {
    gameState.setGame(game());
    gameState.setCurrentPlayer(player());
    gameState.setCombatState({
      combatMode: true,
      initiativeOrder: [entry(), entry({ playerId: undefined, npcId: "n1", name: "Goblin", isPlayer: false, score: 9 })],
      currentRound: 2,
      currentTurnIndex: 1,
    });

    new CombatPanelView().render();

    const rows = document.querySelectorAll(".initiative-entry");
    expect(rows).toHaveLength(2);
    expect(rows[1].classList.contains("current-turn")).toBe(true);
    expect(rows[0].classList.contains("current-turn")).toBe(false);
  });

  it("shows DM controls only to the DM", () => {
    gameState.setGame(game());
    gameState.setCombatState({ combatMode: true, initiativeOrder: [entry()], currentRound: 1, currentTurnIndex: 0 });

    gameState.setCurrentPlayer(player({ isDM: false }));
    new CombatPanelView().render();
    expect(document.getElementById("advance-turn-btn")).toBeNull();

    gameState.setCurrentPlayer(player({ isDM: true }));
    new CombatPanelView().render();
    expect(document.getElementById("advance-turn-btn")).not.toBeNull();
  });

  it("advances and ends combat from the DM buttons", () => {
    gameState.setGame(game());
    gameState.setCurrentPlayer(player());
    gameState.setCombatState({ combatMode: true, initiativeOrder: [entry()], currentRound: 1, currentTurnIndex: 0 });
    new CombatPanelView().render();

    document.getElementById("advance-turn-btn")!.dispatchEvent(new Event("click"));
    document.getElementById("end-combat-btn")!.dispatchEvent(new Event("click"));

    expect(sent.map(m => m.type)).toEqual(["TURN_ADVANCE", "COMBAT_END"]);
  });
});

describe("InventoryPanelView", () => {
  beforeEach(() => { document.body.innerHTML = `<div id="inventory-panel"></div>`; });

  it("says the bag is empty rather than rendering nothing", () => {
    gameState.setCurrentPlayer(player());
    new InventoryPanelView().render();

    expect(document.querySelector(".combat-empty")).not.toBeNull();
  });

  it("offers Equip for an unequipped weapon and Unequip once it is worn", () => {
    gameState.setCurrentPlayer(player({ inventory: [item()] }));
    new InventoryPanelView().render();
    expect(document.querySelector("[data-action='equip-weapon']")).not.toBeNull();

    gameState.setCurrentPlayer(player({ inventory: [item()], equippedWeapon: item() }));
    new InventoryPanelView().render();
    expect(document.querySelector("[data-action='unequip-weapon']")).not.toBeNull();
  });

  it("unequips instead of re-equipping the item already worn", () => {
    gameState.setCurrentPlayer(player({ inventory: [item()], equippedWeapon: item() }));
    new InventoryPanelView().render();

    document.querySelector<HTMLElement>("[data-action='unequip-weapon']")!.dispatchEvent(new Event("click"));

    expect(sent.at(-1)).toEqual({ type: "UNEQUIP_WEAPON", payload: { itemId: "sword-1" } });
  });

  it("uses a consumable", () => {
    gameState.setCurrentPlayer(player({
      inventory: [item({ id: "potion-1", name: "Healing Potion", type: "consumable", stats: { healingAmount: 8 } })],
    }));
    new InventoryPanelView().render();

    document.querySelector<HTMLElement>("[data-action='use-item']")!.dispatchEvent(new Event("click"));

    expect(sent.at(-1)).toEqual({ type: "USE_ITEM", payload: { itemId: "potion-1" } });
  });
});

describe("PlayersPanelView", () => {
  beforeEach(() => { document.body.innerHTML = `<aside class="players-panel"></aside>`; });

  it("renders a card per player plus the DM card", () => {
    gameState.setGame(game({ players: [player(), player({ id: "p2", characterName: "Wren" })] }));
    document.querySelector(".players-panel")!.innerHTML = new PlayersPanelView().render("🏰 Dungeon");

    expect(document.querySelectorAll("li.player-status")).toHaveLength(2);
    expect(document.querySelector(".dm-card")).not.toBeNull();
  });

  it("colours the HP bar by how hurt the character is", () => {
    const panel = new PlayersPanelView();
    gameState.setGame(game({ players: [player({ hp: 11, maxHp: 12 })] }));
    document.querySelector(".players-panel")!.innerHTML = panel.render("x");
    expect(document.querySelector(".hp-bar-fill")?.classList.contains("high")).toBe(true);

    gameState.setGame(game({ players: [player({ hp: 2, maxHp: 12 })] }));
    document.querySelector(".players-panel")!.innerHTML = panel.render("x");
    expect(document.querySelector(".hp-bar-fill")?.classList.contains("low")).toBe(true);
  });

  it("patches HP in place without re-rendering the list", () => {
    const panel = new PlayersPanelView();
    gameState.setGame(game());
    document.querySelector(".players-panel")!.innerHTML = panel.render("x");

    gameState.setGame(game({ players: [player({ hp: 1, maxHp: 12 })] }));
    panel.updateHP();

    expect(document.querySelector(".hp-bar-text")?.textContent).toContain("1/12");
    expect(document.querySelector(".hp-bar-fill")?.classList.contains("low")).toBe(true);
  });
});

describe("ChatView", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="chat-messages"></div><div id="stream-display"></div>`;
  });

  it("renders the whole history", () => {
    gameState.setGame(game({
      chatHistory: [
        { id: "1", content: "Hello", type: "text", timestamp: Date.now(), playerName: "Ana", characterName: "Ranulf" },
        { id: "2", content: "The door creaks open.", type: "narrative", timestamp: Date.now() },
      ],
    }));

    new ChatView().render();

    expect(document.querySelectorAll(".message")).toHaveLength(2);
    expect(document.body.textContent).toContain("The door creaks open.");
  });

  it("escapes message content instead of rendering it as markup", () => {
    gameState.setGame(game({
      chatHistory: [{ id: "1", content: "<script>alert(1)</script>", type: "text", timestamp: Date.now(), playerName: "x" }],
    }));

    new ChatView().render();

    expect(document.querySelector("#chat-messages script")).toBeNull();
    expect(document.body.textContent).toContain("<script>");
  });

  it("clears the streaming area when the turn ends", () => {
    const chat = new ChatView();
    gameState.updateStreamBuffer("partial narration");
    chat.renderStream();
    expect(document.getElementById("stream-display")?.textContent).toContain("partial narration");

    chat.clearStream();
    expect(document.getElementById("stream-display")?.innerHTML).toBe("");
  });

  it("formats a plain dice roll with its modifier", () => {
    const text = formatDiceResult({
      id: "d1", playerId: "p1", playerName: "Ana", characterName: "Ranulf",
      diceType: 20, count: 1, rolls: [14], modifier: 3, total: 17,
      isHit: true, timestamp: Date.now(),
    });

    expect(text).toContain("d20");
    expect(text).toContain("17");
    expect(text).toContain("14");
  });
});
