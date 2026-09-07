// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { formatDiceResult } from "../../public/js/views/chat.js";
import type { DiceRoll } from "../../shared/index.js";

const roll = (over: Partial<DiceRoll> = {}): DiceRoll => ({
  player: "Ranulf", diceType: 20, rolls: [12], modifier: 3, total: 15, timestamp: Date.now(),
  ...over,
} as DiceRoll);

describe("formatDiceResult", () => {
  it("renders a wax seal carrying the total, plus a detail line", () => {
    const html = formatDiceResult(roll());
    expect(html).toContain('<span class="dice-seal"');
    expect(html).toContain(">15</span>");
    expect(html).toContain("d20 +3 (12)");
  });

  it("gilds a natural 20 and blacks a natural 1", () => {
    expect(formatDiceResult(roll({ rolls: [20], total: 23 }))).toContain("dice-seal crit");
    expect(formatDiceResult(roll({ rolls: [1], total: 4 }))).toContain("dice-seal fumble");
  });

  it("only treats d20s as criticals", () => {
    expect(formatDiceResult(roll({ diceType: 6, rolls: [6], modifier: 0, total: 6 }))).not.toContain("crit");
  });

  it("signs the modifier in the detail and drops it when zero", () => {
    expect(formatDiceResult(roll({ modifier: -3, total: 9 }))).toContain("d20 -3 (");
    expect(formatDiceResult(roll({ modifier: 0, total: 12 }))).toContain("d20 (");
  });

  it("tints skill checks by outcome and escapes hostile detail", () => {
    const check = roll({ skillCheck: { skill: "Stealth", success: true, dc: 15 } as DiceRoll["skillCheck"] });
    expect(formatDiceResult(check)).toContain("dice-detail success");
    const evil = roll({ skillCheck: { skill: "<img src=x onerror=alert(1)>", success: false, dc: 10 } as DiceRoll["skillCheck"] });
    const html = formatDiceResult(evil);
    expect(html).toContain("dice-detail failure");
    expect(html).not.toContain("<img");
  });
});
