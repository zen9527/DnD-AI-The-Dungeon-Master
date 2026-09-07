import { describe, it, expect } from "vitest";
import { icon, ICON_NAMES, type IconName } from "../../public/js/icons.js";

describe("icon()", () => {
  it("declares every name the UI needs", () => {
    for (const name of [
      "sword", "search", "chat", "run", "brain", "shield", "potion", "spellbook",
      "dice", "candle", "heart", "gear", "dial", "backpack", "scroll",
      "folder-open", "trash", "flag", "arrow-right",
    ] as IconName[]) {
      expect(ICON_NAMES).toContain(name);
    }
  });

  it("returns a stroke-based currentColor SVG for every icon", () => {
    for (const name of ICON_NAMES) {
      const svg = icon(name);
      expect(svg.startsWith("<svg"), `icon ${name}`).toBe(true);
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).toContain('viewBox="0 0 20 20"');
    }
  });

  it("is safe to interpolate: no script tags, no event handlers", () => {
    for (const name of ICON_NAMES) {
      expect(icon(name)).not.toMatch(/<script|on\w+=/i);
    }
  });
});
