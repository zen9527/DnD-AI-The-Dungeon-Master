// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Game, NPC, Player } from "../../../shared/index.js";

/**
 * The DM panel is where the "UI is badly made" complaint actually lived: it
 * read `gameState.npcs` and `gameState.players`, which did not exist, so it
 * always rendered zero NPCs and an empty player dropdown. These tests pin the
 * render and the messages each control sends.
 */

const sent: Array<{ type: string; payload: Record<string, unknown> }> = [];

vi.mock("../../../public/js/websocket.js", () => ({
  wsManager: { send: (m: { type: string; payload: Record<string, unknown> }) => sent.push(m) },
}));

// Translate to the key itself so assertions don't depend on copy.
vi.mock("../../../public/js/i18n.js", () => ({
  t: (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${Object.values(params).join(",")}` : key,
}));

const { gameState } = await import("../../../public/js/game-state.js");
const { DMControlsView } = await import("../../../public/js/views/dm-controls.js");

function npc(overrides: Partial<NPC> = {}): NPC {
  return {
    id: "goblin-1", name: "Goblin Warrior", description: "A hostile goblin",
    role: "hostile", hp: 4, maxHp: 7, ac: 15,
    attributes: { str: 8, dex: 14, con: 10, int: 8, wis: 10, cha: 6 },
    createdAt: Date.now(), conditions: ["poisoned"], buffs: [],
    ...overrides,
  };
}

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1", name: "Ana", characterName: "Ranulf", isDM: true,
    race: "Human", characterClass: "Fighter", level: 3,
    attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    hp: 10, maxHp: 10, ac: 11, proficiencyBonus: 2,
    spellSlots: {}, spells: [], inventory: [], usedItems: [],
    conditions: [], buffs: [], hitDice: { total: 1, used: 0 },
    deathSaves: { successes: 0, failures: 0 }, xp: 0, locale: "en-US",
    ...overrides,
  };
}

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: "g1", name: "Test", maxPlayers: 4, scenario: "dungeon",
    players: [player()], npcs: [npc()], chatHistory: [],
    conversationHistory: [], createdAt: Date.now(),
    combatMode: false, initiativeOrder: [], currentRound: 1, currentTurnIndex: 0,
    ...overrides,
  };
}

let view: InstanceType<typeof DMControlsView>;

beforeEach(() => {
  sent.length = 0;
  document.body.innerHTML = `<div id="dm-control-panel"></div>`;
  gameState.clear();
  view = new DMControlsView();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("DMControlsView rendering", () => {
  it("lists the NPCs actually in the game", () => {
    gameState.setGame(game());
    gameState.setCurrentPlayer(player());

    view.render();

    const items = document.querySelectorAll(".npc-item");
    expect(items).toHaveLength(1);
    expect(document.querySelector(".npc-name")?.textContent).toBe("Goblin Warrior");
  });

  it("populates the player dropdowns", () => {
    gameState.setGame(game({ players: [player(), player({ id: "p2", characterName: "Wren", isDM: false })] }));
    gameState.setCurrentPlayer(player());

    view.render();

    const options = document.querySelectorAll("#award-xp-form select[name='playerId'] option");
    expect(options).toHaveLength(2);
    expect(Array.from(options).map(o => o.textContent?.trim())).toContain("Wren");
  });

  it("reflects the conditions an NPC already has", () => {
    gameState.setGame(game());
    gameState.setCurrentPlayer(player());

    view.render();

    const poisoned = document.querySelector<HTMLInputElement>('input[data-condition="poisoned"]');
    const prone = document.querySelector<HTMLInputElement>('input[data-condition="prone"]');
    expect(poisoned?.checked).toBe(true);
    expect(prone?.checked).toBe(false);
  });

  it("sets the HP slider to the NPC's current and maximum HP", () => {
    gameState.setGame(game());
    gameState.setCurrentPlayer(player());

    view.render();

    const slider = document.querySelector<HTMLInputElement>(".hp-slider");
    expect(slider?.value).toBe("4");
    expect(slider?.max).toBe("7");
  });

  it("renders nothing for a player who is not the DM", () => {
    gameState.setGame(game());
    gameState.setCurrentPlayer(player({ isDM: false }));

    view.render();

    expect(document.getElementById("dm-control-panel")?.innerHTML).toBe("");
  });

  it("escapes NPC names rather than injecting them as markup", () => {
    gameState.setGame(game({ npcs: [npc({ name: "<img src=x onerror=alert(1)>" })] }));
    gameState.setCurrentPlayer(player());

    view.render();

    expect(document.querySelector(".npc-name")?.querySelector("img")).toBeNull();
    expect(document.querySelector(".npc-name")?.textContent).toContain("<img");
  });
});

describe("DMControlsView actions", () => {
  beforeEach(() => {
    gameState.setGame(game());
    gameState.setCurrentPlayer(player());
    view.render();
  });

  it("sends NPC HP only when the drag ends, not while dragging", () => {
    const slider = document.querySelector<HTMLInputElement>(".hp-slider")!;
    slider.value = "2";

    // Dragging: the readout follows, but nothing goes to the server — each
    // message broadcasts the whole game state to every client.
    slider.dispatchEvent(new Event("input"));
    expect(sent).toHaveLength(0);
    expect(document.querySelector(".hp-display")?.textContent).toContain("2/7");

    slider.dispatchEvent(new Event("change"));
    expect(sent).toEqual([{ type: "NPC_UPDATE_HP", payload: { npcId: "goblin-1", newHp: 2 } }]);
  });

  it("applies and removes conditions from the checkbox", () => {
    const prone = document.querySelector<HTMLInputElement>('input[data-condition="prone"]')!;

    prone.checked = true;
    prone.dispatchEvent(new Event("change"));
    expect(sent.at(-1)).toEqual({
      type: "NPC_APPLY_CONDITION",
      payload: { npcId: "goblin-1", condition: "prone" },
    });

    prone.checked = false;
    prone.dispatchEvent(new Event("change"));
    expect(sent.at(-1)).toEqual({
      type: "NPC_REMOVE_CONDITION",
      payload: { npcId: "goblin-1", condition: "prone" },
    });
  });

  it("submits the NPC form with its stat block", () => {
    const form = document.getElementById("create-npc-form") as HTMLFormElement;
    (form.querySelector('[name="name"]') as HTMLInputElement).value = "Orc";
    (form.querySelector('[name="hp"]') as HTMLInputElement).value = "15";
    (form.querySelector('[name="ac"]') as HTMLInputElement).value = "16";

    form.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(sent.at(-1)?.type).toBe("NPC_CREATE");
    expect(sent.at(-1)?.payload).toMatchObject({ name: "Orc", hp: 15, ac: 16, role: "hostile" });
  });

  it("awards XP to the selected player", () => {
    const form = document.getElementById("award-xp-form") as HTMLFormElement;
    (form.querySelector('[name="amount"]') as HTMLInputElement).value = "250";

    form.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(sent.at(-1)).toEqual({ type: "PLAYER_AWARD_XP", payload: { playerId: "p1", amount: 250 } });
  });

  it("starts combat from the quick action", () => {
    document.getElementById("start-combat-btn")?.dispatchEvent(new Event("click"));

    expect(sent.at(-1)).toEqual({ type: "COMBAT_START", payload: { startInitiative: true } });
  });

  it("asks before deleting an NPC and honours a refusal", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    document.querySelector<HTMLElement>("[data-action='delete-npc']")?.dispatchEvent(new Event("click"));
    expect(sent).toHaveLength(0);

    confirmSpy.mockReturnValue(true);
    document.querySelector<HTMLElement>("[data-action='delete-npc']")?.dispatchEvent(new Event("click"));
    expect(sent.at(-1)).toEqual({ type: "NPC_DELETE", payload: { npcId: "goblin-1" } });

    confirmSpy.mockRestore();
  });
});
