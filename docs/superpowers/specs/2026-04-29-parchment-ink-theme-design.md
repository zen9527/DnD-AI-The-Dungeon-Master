# DnD Game Interface — Parchment & Ink Theme Design Spec

**Date:** 2026-04-29  
**File:** `public/css/style.css` (full rewrite of existing styles)  
**Goal:** Replace the current flat dark-blue UI with a warm, atmospheric Parchment & Ink theme that feels like an ancient campaign journal — tactile, earthy, classic D&D.

---

## 1. Design Direction: Parchment & Ink

Selected from three options after visual comparison in browser mockup. The winning direction combines warmth and depth without feeling dated or overly ornate.

**Core aesthetic:** Warm dark brown base with gold/amber accents (#c9a84c). Feels like reading an ancient campaign journal — earthy, tactile, classic D&D.

---

## 2. Color Palette

| Role | Hex | Usage |
|------|-----|-------|
| **Primary BG** | `#1a1410` | Main page background, input fields, message bodies |
| **Panel BG** | `#2a2015` | Sidebar panels, chat area background, settings modal |
| **Accent Gold** | `#c9a84c` | DM messages, headers, active elements, HP bars, borders on narrative |
| **Gold Light** | `#e6b85c` | HP bar gradient highlight, button hover states |
| **Text Primary** | `#d4c5a9` | Body text, character names, message content |
| **Text Muted** | `#6b5a3e` | Timestamps, labels, secondary info, placeholder text |
| **Border** | `#3d2e1f` | Panel borders, dividers, input outlines |
| **Border Strong** | `#5a4020` | Action button borders |
| **Player Green** | `#4ade80` | Player messages left border, potion buttons, success states |
| **DM Purple** | `#a78bfa` | DM card sidebar indicator (kept from existing for contrast) |
| **Dice Gold** | `#fbbf24` | Dice roll messages — brighter gold to stand out |
| **Error Red** | `#dc2626` | Error messages, low HP states |

---

## 3. Typography & Sizing

- Font: `'Segoe UI', system-ui, sans-serif` (unchanged)
- Body text: `0.85rem` — slightly larger than current for readability in chat
- Labels/headers: `0.7rem`, uppercase with `letter-spacing: 1px` for a journal-like feel
- Character names in messages: bold, colored by role
- Timestamps: muted text color

---

## 4. Component Styles

### Welcome Screen (Character Creation)
- Background: `#1a1410`
- Title: gold (#c9a84c), centered, larger font size
- Scenario cards: dark brown background with gold border on hover/selected state
- Form inputs: dark brown background, muted text, gold accent on focus (border color + subtle glow)
- Primary button: gold background (#c9a84c) with dark text (#1a1410) — high contrast
- Secondary buttons: dark brown fill, gold border, gold text

### Game Header
- Dark brown bar with bottom gold/amber divider line (subtle, not heavy)
- Campaign name in gold, game ID and scenario tag in muted text below
- Settings button: minimal outline style matching theme

### Party Sidebar
- Panel background: `#2a2015` with border `#3d2e1f`
- "PARTY" label: uppercase, letter-spaced, muted gold text (#6b5a3e)
- Character cards: dark brown fill with colored left border (gold for player, purple for DM)
- HP bar: thin 8px height, gradient from `#c9a84c` to `#e6b85c`, rounded corners. Percentage width based on current/max HP ratio. Below the bar: "HP X/Y" in muted text.
- Low HP warning (<20%): shift gradient toward error red (#dc2626)

### Chronicle (Chat Area)
- Panel background: `#2a2015` with border `#3d2e1f`
- "CHRONICLE" label: uppercase, letter-spaced, muted gold text
- DM/Narrative messages: dark brown fill, left border 3px in gold (#c9a84c), rounded corners (6px)
- Player messages: same layout but left border green (#4ade80)
- Dice roll messages: left border bright gold (#fbbf24), dice result shown with bracketed rolls and modifier, final total highlighted in accent gold
- Message header: role name + timestamp on separate line, smaller font
- Message content: `line-height: 1.6` for comfortable reading of narrative prose

### Action Bar
- Preset action buttons (Attack, Search, Talk, Move): dark brown fill (#3d2e1f), gold border (#5a4020), gold text — pill shape (border-radius: 16px)
- Hover state: slightly lighter background (#4a3825), brighter border
- Potion buttons: green theme (#064e3b fill, #059669 border, #4ade80 text) with 🧪 emoji prefix
- Spell dropdown: dark brown fill, gold border (#c9a84c55), grouped by spell level using `<optgroup>` labels ("1st Level", "2nd Level", etc.)
- Free text input: dark brown background matching message bodies, placeholder in muted text, send button in solid gold with dark text

### Settings Modal
- Overlay: semi-transparent black (#00000080)
- Panel: dark brown fill, gold border, rounded corners (12px)
- Header: gold title, close button in muted text
- Result messages: styled per outcome type (success = green bg, error = red bg)

### Notifications
- Toast notifications slide in from bottom-right
- Success: green background with light green text
- Error: dark red background with light red text  
- Info: muted blue background with light blue text

---

## 5. Visual Enhancements Over Current UI

| Element | Before | After |
|---------|--------|-------|
| Background | Flat `#1a1a2e` (blue-black) | Warm dark brown `#1a1410` |
| Panels | Solid `#16213e` with `#333` borders | Layered `#2a2015` with `#3d2e1f` borders, subtle depth |
| Buttons | Blue fill (`#0f3460`) | Pill-shaped dark brown with gold border, hover glow |
| HP display | Text-only "HP: 25/30" | Gradient progress bar + text label |
| Message styling | Simple left-border color | Rich card layout with role header, timestamp, line-height padding |
| Header divider | Thin `#333` border | Gold-tinted divider (`#c9a84c33`) |
| Focus states | None (plain outline) | Subtle gold glow via box-shadow |

---

## 6. Implementation Strategy

### File: `public/css/style.css` — Complete Rewrite
- Remove all existing styles (~467 lines)
- Write new stylesheet organized by section: palette variables → base/reset → welcome screen → game header → party sidebar → chronicle (chat) → action bar → settings modal → notifications
- CSS custom properties for all colors to allow easy future tweaking

### File: `public/js/character.ts` — HP Bar Rendering
- Add HP bar HTML generation in character card rendering
- Calculate percentage width from current/max HP ratio
- Apply gradient background with low-HP warning color shift

### File: `public/js/action-bar.ts` — Minor Updates
- Update button styling classes to match new theme (pill shape, gold borders)
- No logic changes needed — only visual class updates

### Files Unchanged
- `public/js/app.ts` — DOM structure remains compatible with new CSS
- `public/js/game-state.ts` — subscription logic unchanged
- `public/js/websocket.ts` — message handling unchanged

---

## 7. Scope Boundary

**In scope:** Complete visual redesign of all UI elements in the Parchment & Ink theme, HP progress bars, styled dice roll messages, pill-shaped action buttons, gold-tinted dividers, focus glow states.

**Out of scope:** New HTML structure changes (DOM tree stays the same), new JavaScript logic beyond HP bar rendering, font changes (keeps Segoe UI/system-ui), animations beyond existing slide-in for notifications and blink cursor for streaming.

---

## 8. Quality Checklist

- [ ] All color values use consistent palette — no ad-hoc hex values scattered
- [ ] HP bars render correctly at all percentages (0%, 100%, edge cases)
- [ ] Low HP warning triggers at <20% threshold
- [ ] Dice roll messages display bracketed rolls + modifier + total format
- [ ] Spell dropdown uses optgroups grouped by level number
- [ ] All interactive elements have hover states defined
- [ ] Focus states visible for accessibility (gold glow on inputs/selects)
- [ ] No layout shifts — existing flex/grid structure preserved
- [ ] CSS custom properties used throughout for maintainability
