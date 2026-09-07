# Phase A — Visual Atmosphere: Design

Date: 2026-09-07 · Status: approved (dice direction picked in browser companion; rest delegated)
Parent: `2026-09-06-product-polish-design.md` (phase A of the four-phase polish plan)

## Goal

The game is now solid underneath. Phase A makes it *feel* like a living campaign
journal at the table — on the laptop hosting the game and on the phones friends
joined from. Pure presentation: no server, protocol, or state changes.

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Dice presentation | **Wax seal** (owner-picked over floating number / flip card) |
| 2 | DM presence | Candle flame beside the composing status, reusing `candleFlicker` |
| 3 | Icons | Inline SVG sprite module replacing all UI emoji |
| 4 | Texture | Static SVG-noise + vignette overlay on reading surfaces |
| 5 | Responsive | Mobile-out (existing base rules); every new element sized/tuned for phones explicitly |

## Components

### 1. Wax-seal dice results

`formatDiceResult` (public/js/views/chat.ts) returns markup instead of plain text:

- **Seal badge**: circular wax-stamp with the total. Normal roll = dark red wax;
  natural 20 = gilt with one expanding gold ring; natural 1 = black wax.
- **Detail line** beside it: `Ranulf · d20 + 3 (12+3)` — same information as today,
  plus the existing jade/rust success/failure tint on skill checks (text only).
- Stamp-in animation (`scale(2.2) → 1`, ~450ms, overshoot easing), once per render;
  a re-render of the log must not restamp — seal carries the message id so only new
  messages animate (CSS animation runs on element creation; full `render()` rebuilds,
  which is acceptable since it happens between turns, not mid-combat spam).
- Data unchanged: everything derives from `DiceRoll` already in the message.

### 2. DM composing presence

The status line shown while the DM streams gets a small candle flame (CSS shape or
inline SVG) using the existing `candleFlicker` keyframes, next to the current typing
cursor. When reduced motion is preferred: static flame glyph, no flicker.

### 3. Inline SVG icon set

New module `public/js/icons.ts`:

- `icon(name: IconName): string` returning an inline `<svg>` string — stroke-based,
  `currentColor`, 20×20 viewBox, slightly hand-drawn line weight to match the theme.
- ~16 icons: sword, shield, potion, spellbook, backpack, scroll (save), folder-open
  (load), gear, dial (DM panel), heart, dice, candle, check, cross, trash, bookmark.
- Replaces emoji in code: action-bar potion buttons, app.ts header buttons, character
  hero title + settings trigger, dm-controls button, saved-games badge/delete,
  players-panel HP heart, join-view/settings-modal triggers, chat dice line.
- **Locales**: leading emoji stripped from values (e.g. `"⚔️ Attack"` → `"Attack"`);
  keys untouched; icons rendered from code beside the text. Parity test must stay green.

### 4. Parchment texture layer

Fixed pseudo-element overlay on the reading surface (vellum): SVG `feTurbulence`
noise as a data-URI at ~4% opacity + radial vignette. Static — no images, no repaint
cost while scrolling. Phone tuning: lower noise density and softer vignette below the
first breakpoint (small viewports make uniform grain look muddy).

## Responsive contract

The stylesheet is mobile-out; this phase keeps that discipline:

- Seal size via `clamp()` (~28px phone → 34px desktop); inline-flex row, never wraps.
- Icons inherit color and sit on the text baseline at `1em` — no per-breakpoint sizes.
- Texture density/strength steps down under the first breakpoint.
- `prefers-reduced-motion: reduce` disables stamp-in, flame flicker, and the gold
  crit ring (seal still shows, statically).
- Cross-platform win: SVG icons render identically on Android/iOS/Windows, unlike emoji.

## Testing

- **Unit**: `icons.ts` — every declared icon name returns a valid `<svg>` string with
  `currentColor`; dice formatter outputs seal markup + total text for crit/fumble/normal.
- **Locale parity**: green after emoji-in-value removal (keys unchanged).
- **E2E**: flow 3 asserts the seal element and total text; flow 7 (phone viewport)
  asserts seal + icons render at phone width. All other flows untouched.

## Out of scope

Theme-switching system · motion settings UI · bitmap/painted textures · server-side
dice presentation changes · new dice mechanics.
