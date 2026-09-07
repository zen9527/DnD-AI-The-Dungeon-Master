# Phase A — Visual Atmosphere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the UI feel like a living campaign journal — wax-seal dice results, a candle-lit DM presence, inline SVG icons replacing emoji, and a parchment texture layer — with phones explicitly tuned.

**Architecture:** Pure presentation layer. One new frontend module (`public/js/icons.ts`) feeds every rendering site; the dice formatter becomes an HTML producer consumed by the chat view; CSS carries seal/texture/flame styling on top of the existing token system. No server, protocol, or shared-schema changes.

**Tech Stack:** TypeScript (Vite-built `public/js`), vitest (`tests/frontend/`), Playwright e2e against the stub DM, vanilla CSS with the Parchment & Ink tokens.

**Spec:** `docs/superpowers/specs/2026-09-07-phase-a-visual-atmosphere-design.md`

**Verification commands (every task):**
- `npm run typecheck:frontend -s` → expect no output, exit 0
- `npx vitest run` → expect all green (390+ tests)
- e2e only in Tasks 2 and 6: `npx playwright test` (never `npm start`)

**Locale discipline:** every locale value change touches all five files in `locales/` (en-US, zh-CN, ja-JP, es-ES, ko-KR); `tests/i18n/locale-parity.test.ts` enforces identical key sets.

---

### Task 1: Icon module (`public/js/icons.ts`)

**Files:**
- Create: `public/js/icons.ts`
- Test: `tests/frontend/icons.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/frontend/icons.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/frontend/icons.test.ts`
Expected: FAIL — cannot resolve `../../public/js/icons.js`.

- [ ] **Step 3: Implement the module**

Create `public/js/icons.ts`:

```ts
/**
 * Inline SVG icon set for the whole UI.
 *
 * Emoji render differently on every OS (and not at all in some enterprise
 * fonts); these draw identically everywhere, inherit the theme color through
 * `currentColor`, and match the journal's hand-inked line weight. 20×20
 * viewBox, stroke-based, no fills — size them with CSS (`1em` next to text).
 */

const PATHS = {
  sword: '<path d="M14.5 3.5l2 2L7 15l-3 1 1-3 9.5-9.5zM12.5 5.5l2 2"/>',
  search: '<circle cx="8.5" cy="8.5" r="4"/><path d="M11.5 11.5L16 16"/>',
  chat: '<path d="M4 5a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H9l-3 3v-3H5a1 1 0 01-1-1V5z"/>',
  run: '<circle cx="11.5" cy="4" r="1.6"/><path d="M10.5 7.5L8 11l3 2v4M8 11l-3 .5M11 13l3 .5 1 3"/>',
  brain: '<path d="M10 4.5A2.5 2.5 0 007.5 3 2.7 2.7 0 005 5.6a2.5 2.5 0 00-1 4.4A2.6 2.6 0 005.5 15a2.4 2.4 0 004.5 1V4.5zM10 4.5A2.5 2.5 0 0112.5 3 2.7 2.7 0 0115 5.6a2.5 2.5 0 011 4.4A2.6 2.6 0 0114.5 15a2.4 2.4 0 01-4.5 1"/>',
  shield: '<path d="M10 3l6 2v5c0 4-3 6.5-6 7.5C7 16.5 4 14 4 10V5l6-2z"/>',
  potion: '<path d="M8 3h4M9 3v4l-3.5 7a3 3 0 003 4h3a3 3 0 003-4L11 7V3M6.2 12.5h7.6"/>',
  spellbook: '<path d="M5 3h9a2 2 0 012 2v12H7a2 2 0 00-2 2V3zM5 17a2 2 0 012-2M8.5 7l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L5.5 9.3l2-.3z"/>',
  dice: '<rect x="3" y="3" width="14" height="14" rx="3"/><circle cx="7" cy="7" r=".9"/><circle cx="13" cy="7" r=".9"/><circle cx="10" cy="10" r=".9"/><circle cx="7" cy="13" r=".9"/><circle cx="13" cy="13" r=".9"/>',
  candle: '<path d="M10 2c1.4 1.9 2 2.8 2 4a2 2 0 01-4 0c0-1.2.6-2.1 2-4zM10 7v2M7.5 9h5v8h-5z"/>',
  heart: '<path d="M10 17s-6-4.4-6-9a3.5 3.5 0 016-2.4A3.5 3.5 0 0116 8c0 4.6-6 9-6 9z"/>',
  gear: '<circle cx="10" cy="10" r="3"/><path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.4 4.4l1.8 1.8M13.8 13.8l1.8 1.8M15.6 4.4l-1.8 1.8M6.2 13.8l-1.8 1.8"/>',
  dial: '<path d="M3 6h14M3 14h14"/><circle cx="7" cy="6" r="2"/><circle cx="13" cy="14" r="2"/>',
  backpack: '<rect x="5" y="7" width="10" height="10" rx="2"/><path d="M8 7V5a2 2 0 014 0v2M7.5 13h5"/>',
  scroll: '<path d="M6 3h10a2 2 0 012 2H8a2 2 0 00-2 2v9a2 2 0 01-2-2V5a2 2 0 012-2zM10 8h5M10 11.5h5"/>',
  "folder-open": '<path d="M3 6a1 1 0 011-1h4l2 2h6a1 1 0 011 1v1H3V6zM3 10h15l-2.2 6H5.2L3 10z"/>',
  trash: '<path d="M5 6h10l-1 11H6L5 6zM8 6V4h4v2M8.5 9.5v4M11.5 9.5v4"/>',
  flag: '<path d="M5 3v14M5 4h10l-2 3 2 3H5"/>',
  "arrow-right": '<path d="M4 10h11M11 6l4 4-4 4"/>',
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

/** Inline `<svg>` markup for `name`, sized by CSS, colored by `currentColor`. */
export function icon(name: IconName): string {
  return `<svg class="icon" viewBox="0 0 20 20" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/frontend/icons.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Full verification + commit**

```bash
npm run typecheck:frontend -s && npx vitest run
git add public/js/icons.ts tests/frontend/icons.test.ts
git commit -m "feat: inline SVG icon set to replace platform-dependent emoji"
```

---

### Task 2: Wax-seal dice presentation

**Files:**
- Modify: `public/js/views/chat.ts` (formatDiceResult lines ~22-40; append() dice line ~82)
- Modify: `locales/en-US.json`, `locales/zh-CN.json`, `locales/ja-JP.json`, `locales/es-ES.json`, `locales/ko-KR.json` (add `dice.check_detail`; remove `dice.skill_check` and `dice.rolled`)
- Modify: `public/css/style.css` (seal styles; reduced-motion block at ~line 1996)
- Test: `tests/frontend/dice-format.test.ts`
- Test: `tests/e2e/game.spec.ts` (flow 3 assertions, lines ~69-82)

- [ ] **Step 1: Write the failing formatter test**

Create `tests/frontend/dice-format.test.ts`:

```ts
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

  it("tints skill checks by outcome and escapes hostile detail", () => {
    const check = roll({ skillCheck: { skill: "Stealth", success: true, dc: 15 } as DiceRoll["skillCheck"] });
    expect(formatDiceResult(check)).toContain("dice-detail success");
    const evil = roll({ skillCheck: { skill: "<img src=x onerror=alert(1)>", success: false, dc: 10 } as DiceRoll["skillCheck"] });
    const html = formatDiceResult(evil);
    expect(html).toContain("dice-detail failure");
    expect(html).not.toContain("<img");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/frontend/dice-format.test.ts`
Expected: FAIL — output is the old plain-text format (no `dice-seal`).

- [ ] **Step 3: Add the locale key, remove the dead ones**

In all five files add next to the other `dice.` keys, and delete `dice.skill_check` + `dice.rolled` (verified unreferenced in code; `formatDiceResult` is rewritten below):

- en-US: `"dice.check_detail": "{skill} check — {result} (DC {dc})"`
- zh-CN: `"dice.check_detail": "{skill}检定 — {result}（DC {dc}）"`
- ja-JP: `"dice.check_detail": "{skill}判定 — {result}（DC {dc}）"`
- es-ES: `"dice.check_detail": "Prueba de {skill}: {result} (CD {dc})"`
- ko-KR: `"dice.check_detail": "{skill} 판정 — {result} (DC {dc})"`

Validate every file still parses: `for f in locales/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))"; done`

- [ ] **Step 4: Rewrite the formatter to emit seal markup**

In `public/js/views/chat.ts`, replace the whole `formatDiceResult` function (keep `SKILL_LABEL_KEYS` above it untouched) with:

```ts
/**
 * Render a dice roll for the chat log as a wax seal stamped into the page:
 * the total lives in the seal, the arithmetic sits beside it. A natural 20
 * stamps in gilt, a natural 1 in black wax. Skill checks tint their detail
 * line jade or rust. Returns HTML — every interpolated value is escaped.
 */
export function formatDiceResult(dice: DiceRoll): string {
  const natural = dice.rolls[0];
  let variant = "";
  if (dice.diceType === 20 && natural === 20) variant = " crit";
  else if (dice.diceType === 20 && natural === 1) variant = " fumble";

  let detail: string;
  if (dice.skillCheck) {
    const labelKey = SKILL_LABEL_KEYS[dice.skillCheck.skill as keyof typeof SKILL_LABEL_KEYS];
    detail = t("dice.check_detail", {
      skill: labelKey ? t(labelKey) : dice.skillCheck.skill,
      result: t(dice.skillCheck.success ? "dice.success" : "dice.failure"),
      dc: dice.skillCheck.dc,
    });
  } else {
    const rolls = dice.rolls.join(" + ");
    const modifier = dice.modifier ? ` ${dice.modifier > 0 ? "+" : "-"} ${Math.abs(dice.modifier)}` : "";
    detail = `d${dice.diceType}${modifier} (${rolls})`;
  }

  const tone = dice.skillCheck ? (dice.skillCheck.success ? " success" : " failure") : "";
  return `<span class="dice-roll"><span class="dice-seal${variant}" aria-hidden="true">${dice.total}</span><span class="dice-detail${tone}">${escapeHtml(detail)}</span></span>`;
}
```

- [ ] **Step 5: Stop escaping the formatter's HTML at the call site**

In `public/js/views/chat.ts` `append()`, replace:

```ts
    if (message.diceResult) {
      content += `<br><strong>${escapeHtml(formatDiceResult(message.diceResult))}</strong>`;
    }
```

with:

```ts
    if (message.diceResult) {
      // formatDiceResult returns composed HTML with its values already escaped.
      content += `<br>${formatDiceResult(message.diceResult)}`;
    }
```

- [ ] **Step 6: Style the seal**

In `public/css/style.css`, add before the `/* Notifications */` banner (or next to existing `.message` styles):

```css
/* Dice: a wax seal stamped into the chronicle. Normal = dark red wax,
   natural 20 = gilt with a ring of light, natural 1 = black wax. */
.dice-roll { display: inline-flex; align-items: center; gap: var(--s2); margin-top: var(--s1); }

.dice-seal {
  width: clamp(28px, 4vw, 34px);
  aspect-ratio: 1;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  font-weight: 700;
  font-size: 0.9rem;
  color: #f7e7c3;
  background: radial-gradient(circle at 35% 30%, var(--rust), #6e2415);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.55), inset 0 1px 2px rgba(255, 255, 255, 0.3);
  animation: diceStamp 0.45s cubic-bezier(0.2, 1.6, 0.4, 1) both;
}

.dice-seal.crit {
  background: radial-gradient(circle at 35% 30%, var(--gilt-bright), var(--gilt-deep));
  color: #2a2013;
  animation: diceStamp 0.45s cubic-bezier(0.2, 1.6, 0.4, 1) both, diceGild 1.4s ease-out 0.25s 2;
}

.dice-seal.fumble {
  background: radial-gradient(circle at 35% 30%, #4a4340, #17120f);
  color: #b9ac93;
}

.dice-detail.success { color: var(--jade); }
.dice-detail.failure { color: var(--rust); }

@keyframes diceStamp { from { transform: scale(2.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes diceGild { 0% { box-shadow: 0 0 0 0 rgba(240, 205, 132, 0.7); } 100% { box-shadow: 0 0 0 14px rgba(240, 205, 132, 0); } }
```

And inside the existing `@media (prefers-reduced-motion: reduce)` block (~line 1996) append:

```css
  .dice-seal, .dice-seal.crit { animation: none; }
```

- [ ] **Step 7: Run unit tests**

Run: `npx vitest run`
Expected: all green (locale parity passes with the new/removed keys).

- [ ] **Step 8: Update e2e flow 3 for the seal**

In `tests/e2e/game.spec.ts`, replace the body after the d20 click:

```ts
  const roll = page.locator("#chat-messages .message.roll").last();
  await expect(roll).toContainText("d20:");

  // The result has to be a real number in range — 1..20 plus the +3 modifier.
  const text = await roll.locator(".message-content").innerText();
  const total = Number(text.match(/d20:\s*(-?\d+)/)![1]);
  expect(total).toBeGreaterThanOrEqual(4);
  expect(total).toBeLessThanOrEqual(23);
```

with:

```ts
  // The total is stamped in a wax seal; the arithmetic sits beside it.
  const roll = page.locator("#chat-messages .message.roll").last();
  const seal = roll.locator(".dice-seal");
  await expect(seal).toBeVisible();
  await expect(roll.locator(".dice-detail")).toContainText("d20 +3 (");

  // The result has to be a real number in range — 1..20 plus the +3 modifier.
  const total = Number((await seal.innerText()).trim());
  expect(total).toBeGreaterThanOrEqual(4);
  expect(total).toBeLessThanOrEqual(23);
```

- [ ] **Step 9: Full verification + commit**

```bash
npm run typecheck:frontend -s && npx vitest run && npx playwright test
git add public/js/views/chat.ts locales/ public/css/style.css tests/frontend/dice-format.test.ts tests/e2e/game.spec.ts
git commit -m "feat: dice results stamp into the chronicle as wax seals"
```

---

### Task 3: Emoji out of chrome strings and controls

**Files:**
- Modify: all five `locales/*.json` (strip leading emoji from the chrome keys listed below)
- Modify: `public/js/action-bar.ts` (presets ~line 63-65, potion button ~line 71)
- Modify: `public/js/app.ts` (~lines 407-413 header buttons)
- Modify: `public/js/character.ts` (~line 53 hero title, ~line 66 settings trigger)
- Modify: `public/js/views/join-view.ts` (~line 23 settings trigger)
- Modify: `public/js/views/settings-modal.ts` (~line 76 heading)
- Modify: `public/js/views/dm-controls.ts` (~line 39 panel button)
- Modify: `public/js/views/saved-games.ts` (~lines 55, 57 badge + delete)
- Modify: `public/js/views/players-panel.ts` (~lines 73 and 105 HP heart)
- Modify: `public/js/views/chat.ts` (DM sender prefix in `append()`; add icon import)
- Modify: `public/js/views/combat-panel.ts` (~lines 45-46 turn buttons; combat.start site — locate with grep)

**Chrome keys to strip (all five locales, value prefix only — keys unchanged):**
`action.attack` ⚔️ · `action.search` 🔍 · `action.talk` 💬 · `action.hide` 🏃 · `action.intelligence` 🧠 · `action.defend` 🛡️ · `spell.cast_placeholder` 📖 · `combat.start` ⚔️ · `combat.end` 🏁 · `combat.advance_turn` ➡️ · `saved_games.title` 💾 · `inventory.title` 🎒 · `buff.title` ✨ · `dm.name` 🧙

**Deliberately kept as-is:** toast/status strings (`save.*`, `load.*`, `settings.test_*`, `timer.warning`), scenario picker icons in `i18n.ts`, typographic `✕` close buttons.

- [ ] **Step 1: Strip the emoji from locale values**

Apply to each of the five files (values differ per language — only the leading emoji + space are removed; keep every other character). Then validate JSON parses (same loop as Task 2 step 3) and run `npx vitest run tests/i18n/locale-parity.test.ts` → PASS.

- [ ] **Step 2: Preset buttons get icons from code**

In `public/js/action-bar.ts`, add to the imports at top: `import { icon, type IconName } from "./icons.js";` and after `STATIC_PRESETS`:

```ts
/** Which glyph belongs to which preset — icon lives in code, text in locales. */
const PRESET_ICONS: Record<string, IconName> = {
  attack: "sword", search: "search", talk: "chat", hide: "run", arcana: "brain", defend: "shield",
};
```

Replace the preset loop body (line ~64):

```ts
      presetsHtml += `<button class="preset-btn" data-action="${escapeHtml(preset.action())}" data-action-id="${preset.id}">${icon(PRESET_ICONS[preset.id] ?? "sword")} ${escapeHtml(preset.label())}</button>`;
```

And the potion button (line ~71): `🧪 ${escapeHtml(p.name)}` → `${icon("potion")} ${escapeHtml(p.name)}`.

- [ ] **Step 3: Header, triggers, badges, hearts**

Add `import { icon } from "./icons.js";` to each file touched below (relative path `./icons.js` for app.ts/character.ts/action-bar.ts; `../icons.js` for files in `views/`). Then:

- `public/js/app.ts` ~407-413 — replace the three `<span class="btn-icon" aria-hidden="true">🎒</span>` / `💾` / `📂` bodies with `${icon("backpack")}` / `${icon("scroll")}` / `${icon("folder-open")}`.
- `public/js/character.ts` ~53 — `🎲 DnD AI: The Dungeon Master` → `${icon("dice")} DnD AI: The Dungeon Master`; ~66 — `>⚙️</div>` → `>${icon("gear")}</div>`.
- `public/js/views/join-view.ts` ~23 — same ⚙️ replacement as above.
- `public/js/views/settings-modal.ts` ~76 — `<h3>⚙️ ${t("settings.title")}</h3>` → `<h3>${icon("gear")} ${t("settings.title")}</h3>`.
- `public/js/views/dm-controls.ts` ~39 — `🎛️` → `${icon("dial")}`.
- `public/js/views/saved-games.ts` ~55 — `💾` → `${icon("scroll")}`; ~57 — `🗑️` → `${icon("trash")}`.
- `public/js/views/players-panel.ts` ~73 — `❤ ${player.hp}/${player.maxHp}` → `${icon("heart")} ${player.hp}/${player.maxHp}` (inside the template string); ~105 — `text.textContent = ...` must become `text.innerHTML = \`${icon("heart")} ${player.hp}/${player.maxHp}\`;` (numbers only — safe).
- `public/js/views/combat-panel.ts` ~45-46 — `${t("combat.advance_turn")}` → `${icon("arrow-right")} ${t("combat.advance_turn")}`, `${t("combat.end")}` → `${icon("flag")} ${t("combat.end")}`; locate the `combat.start` render site with `grep -n "combat.start" public/js -r` and prefix it with `${icon("sword")} `.
- DM name: at the chat header render (`public/js/views/chat.ts` append, senderName for DM) — leave the plain string but prefix DM messages' sender with the candle in markup: in `append()`, `senderName` usage becomes `<strong class="...">${isDMNarrative ? icon("candle") + " " : ""}${escapeHtml(senderName)}</strong>`.

- [ ] **Step 4: Sweep for stragglers**

Run the emoji scanner used earlier over `public/js` (the node one-liner from planning) — expected remaining hits: only `i18n.ts` scenario icons, `utils.ts` ✕ dismiss, and comment lines. Anything else gets an icon or is documented as kept.

- [ ] **Step 5: Verification + commit**

```bash
npm run typecheck:frontend -s && npx vitest run
git add locales/ public/js/
git commit -m "feat: hand-inked SVG icons replace emoji across the chrome"
```

---

### Task 4: Candle-lit DM presence

**Files:**
- Modify: `public/js/views/chat.ts` (`renderStream`)
- Modify: `public/css/style.css` (flame styles + reduced-motion)

- [ ] **Step 1: Put the candle in the stream display**

In `public/js/views/chat.ts`, ensure `icon` is imported from `"../icons.js"`, then in `renderStream()` replace the `display.innerHTML = ...` line with:

```ts
    display.innerHTML = `<span class="dm-candle">${icon("candle")}</span><div class="streaming"><span class="typing">${escapeHtml(narrative)}<span class="cursor">▊</span></span></div>`;
```

- [ ] **Step 2: Flame styling**

In `public/css/style.css` (next to the seal styles):

```css
/* The DM is at the table: a candle burns beside the live narration. */
.dm-candle { display: inline-flex; margin-right: var(--s1); vertical-align: -0.15em; color: var(--ember); }
.dm-candle svg { animation: candleFlicker 2.6s ease-in-out infinite; filter: drop-shadow(0 0 6px rgba(244, 169, 67, 0.45)); }
```

In the `@media (prefers-reduced-motion: reduce)` block append: `.dm-candle svg { animation: none; }`

- [ ] **Step 3: Verification + commit**

```bash
npm run typecheck:frontend -s && npx vitest run
git add public/js/views/chat.ts public/css/style.css
git commit -m "feat: candle flame marks the DM composing a reply"
```

---

### Task 5: Parchment texture layer

**Files:**
- Modify: `public/css/style.css` (overlay rules; phone tuning; reduced-motion unaffected — static)

- [ ] **Step 1: Grain + vignette overlay**

In `public/css/style.css`, near the top after the token block (so later rules can override stacking if ever needed):

```css
/* Candlelight on paper: a fixed grain of noise and a soft vignette. Static —
   zero repaint while scrolling, no image files. Phones get less grain (uniform
   density reads as mud at their size) and a softer edge darkening. */
body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  opacity: 0.04;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='0.6'/></svg>");
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(13, 9, 6, 0.5) 100%);
}

@media (max-width: 900px) {
  body::after { opacity: 0.025; }
  body::before { background: radial-gradient(ellipse at center, transparent 68%, rgba(13, 9, 6, 0.32) 100%); }
}
```

Note: `z-index` stays below the connection banner (1000) and modals; `pointer-events: none` keeps every control clickable regardless.

- [ ] **Step 2: Verification + commit**

```bash
npm run typecheck:frontend -s && npx vitest run
git add public/css/style.css
git commit -m "feat: static grain and vignette light the parchment"
```

---

### Task 6: Phone assertions, full gate, push

**Files:**
- Modify: `tests/e2e/game.spec.ts` (flow 7)

- [ ] **Step 1: Assert icons + seal at phone width**

In flow 7 (`Smoke: Phone`), after the existing composer-reachability assertions, add:

```ts
  // Phase A elements hold up on the phone: SVG icons in the preset row and a
  // wax seal that fits the narrow column.
  await expect(page.locator(".preset-btn svg.icon").first()).toBeVisible();
  await page.locator('.dice-btn[data-dice="20"]').click();
  await expect(page.locator("#chat-messages .dice-seal").last()).toBeVisible();
```

- [ ] **Step 2: Full gate**

```bash
npm run typecheck && npx vitest run && npm run build && npx playwright test
```

Expected: typecheck clean, all unit tests green, build succeeds, 10 e2e flows pass.

- [ ] **Step 3: Docs + push**

Update `AGENTS.md` (local file, gitignored — still keep it true): add `icons.ts` under `public/js/` in the structure tree and one architecture note: "Icons are inline SVG from `public/js/icons.ts` (`icon(name)`); chrome strings in locales carry text only — never emoji in new locale values. Dice render as wax seals via `formatDiceResult` (returns escaped HTML)."

```bash
git add tests/e2e/game.spec.ts
git commit -m "test: phone viewport checks icons and the wax seal"
git push origin main
```
