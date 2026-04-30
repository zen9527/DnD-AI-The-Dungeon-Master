# Parchment & Ink Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current flat dark-blue UI with a warm, atmospheric Parchment & Ink theme — gold/amber accents on dark brown backgrounds, HP progress bars, pill-shaped action buttons, styled dice roll messages.

**Architecture:** Complete rewrite of `public/css/style.css` (~467 lines → ~500 lines) using CSS custom properties for the palette. Minor enhancement to `public/js/app.ts` renderHP() to inject an HTML progress bar element alongside existing HP text. No backend changes, no TypeScript compilation required (frontend-only).

**Tech Stack:** Vanilla TypeScript + CSS — frontend only, served by Vite dev server / Express static files in production.

---

### Task 1: Rewrite style.css with full Parchment & Ink theme

**Files:**
- Modify: `public/css/style.css` (complete replacement)

This is the core task. Every existing class selector from character.ts, app.ts, and action-bar.ts must be matched. The new stylesheet uses CSS custom properties for all colors so future tweaks are single-line changes.

- [ ] **Step 1: Replace entire contents of public/css/style.css**

Write file `public/css/style.css` with exact contents below:

```css
/* ============================================================================
   Parchment & Ink Theme — DnD Game Interface
   Warm dark brown base, gold/amber accents, ancient campaign journal aesthetic.
   ============================================================================ */

/* --- CSS Custom Properties (Palette) --- */
:root {
  --bg-primary: #1a1410;
  --bg-panel: #2a2015;
  --accent-gold: #c9a84c;
  --accent-gold-light: #e6b85c;
  --text-primary: #d4c5a9;
  --text-muted: #6b5a3e;
  --border-color: #3d2e1f;
  --border-strong: #5a4020;
  --player-green: #4ade80;
  --dm-purple: #a78bfa;
  --dice-gold: #fbbf24;
  --error-red: #dc2626;
  --gold-subtle: #c9a84c33;
}

/* --- Reset & Base --- */
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
}

/* ============================================================================
   Welcome Screen (Character Creation)
   ============================================================================ */
.welcome-screen {
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 20px;
  text-align: center;
}

.welcome-screen h1 {
  font-size: 2rem;
  color: var(--accent-gold);
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.welcome-screen h2 {
  font-size: 1.5rem;
  color: var(--accent-gold);
  margin-bottom: 6px;
}

.welcome-screen .subtitle {
  color: var(--text-muted);
  margin-bottom: 30px;
  font-size: 0.95rem;
}

.options {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.divider { color: var(--text-muted); font-size: 0.9rem; }

.join-form {
  display: flex;
  gap: 10px;
  width: 100%;
  max-width: 400px;
}

.join-form input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 1rem;
}

.join-form input:focus {
  outline: none;
  border-color: var(--accent-gold);
  box-shadow: 0 0 8px #c9a84c22;
}

/* --- Buttons --- */
button {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background: var(--bg-panel);
  color: var(--text-primary);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

button:hover {
  background: #3a2e1f;
  border-color: var(--border-strong);
}

/* Pill-shaped buttons for action bar */
.preset-btn, .action-item-btn, .potion-btn {
  padding: 6px 14px !important;
  font-size: 0.85rem !important;
  border-radius: 16px !important;
  background: var(--bg-panel) !important;
  border: 1px solid var(--border-strong) !important;
  color: var(--accent-gold) !important;
}

.preset-btn:hover, .action-item-btn:hover {
  background: #3a2e1f !important;
  border-color: var(--accent-gold) !important;
  box-shadow: 0 0 8px #c9a84c11 !important;
}

/* Primary button — gold fill, dark text */
button.primary {
  background: var(--accent-gold) !important;
  color: var(--bg-primary) !important;
  font-weight: bold !important;
  border-radius: 6px !important;
  padding: 10px 20px !important;
}

button.primary:hover {
  background: var(--accent-gold-light) !important;
  box-shadow: 0 0 12px #c9a84c33 !important;
}

/* Secondary button — outline style */
button.secondary {
  background: transparent !important;
  border: 1px solid var(--border-strong) !important;
  color: var(--accent-gold) !important;
  border-radius: 6px !important;
  padding: 10px 20px !important;
}

button.secondary:hover {
  background: #3a2e1f !important;
  border-color: var(--accent-gold) !important;
}

/* Potion button — green theme */
.potion-btn {
  background: #064e3b !important;
  border: 1px solid #059669 !important;
  color: var(--player-green) !important;
}

.potion-btn:hover {
  background: #065f46 !important;
  border-color: #10b981 !important;
  box-shadow: 0 0 8px #4ade8022 !important;
}

/* --- Forms --- */
form label {
  display: block;
  text-align: left;
  margin-bottom: 15px;
  font-size: 0.95rem;
  color: var(--text-primary);
}

form input, form select {
  display: block;
  width: 100%;
  max-width: 300px;
  margin-top: 5px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.95rem;
}

form input:focus, form select:focus {
  outline: none;
  border-color: var(--accent-gold);
  box-shadow: 0 0 8px #c9a84c22;
}

/* --- Attributes Grid --- */
.attributes-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  max-width: 300px;
  margin: 15px auto;
}

.attributes-grid label {
  text-align: center;
}

/* --- Form Rows & Actions --- */
.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  max-width: 300px;
  margin-bottom: 15px;
}

.form-row.auto-filled {
  animation: highlightFill 0.8s ease;
}

@keyframes highlightFill {
  0% { opacity: 0.5; }
  50% { background: #c9a84c22; }
  100% { opacity: 1; }
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
}

hr { border: none; border-top: 1px solid var(--border-color); margin: 20px 0; }

/* ============================================================================
   Scenario Cards (Welcome Screen)
   ============================================================================ */
.scenario-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  width: 100%;
  max-width: 500px;
  margin: 20px auto;
}

.scenario-card {
  padding: 16px;
  border-radius: 10px;
  background: var(--bg-panel);
  border: 2px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.scenario-card:hover {
  border-color: var(--accent-gold);
  background: #3a2e1f;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px #c9a84c11;
}

.scenario-card.selected {
  border-color: var(--accent-gold);
  background: #c9a84c22;
  box-shadow: 0 0 15px #c9a84c33;
}

.scenario-icon { font-size: 2rem; margin-bottom: 6px; }
.scenario-label {
  font-weight: bold;
  color: var(--accent-gold);
  font-size: 0.95rem;
  margin-bottom: 4px;
}
.scenario-desc {
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.3;
}

/* ============================================================================
   Game Interface — Header
   ============================================================================ */
.game-interface { height: 100vh; display: flex; flex-direction: column; }

.game-header {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 12px 20px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--gold-subtle);
}

.game-header h2 { color: var(--accent-gold); font-size: 1.2rem; letter-spacing: 0.5px; }
.game-id { color: var(--text-muted); font-size: 0.85rem; }

.game-header button {
  background: none !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-muted) !important;
  padding: 4px 10px !important;
  border-radius: 6px !important;
  font-size: 0.8rem !important;
}

.game-header button:hover {
  background: #3a2e1f !important;
  color: var(--accent-gold) !important;
  border-color: var(--border-strong) !important;
}

/* ============================================================================
   Game Interface — Main Content Layout
   ============================================================================ */
.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* --- Players Panel (Sidebar) --- */
.players-panel {
  width: 200px;
  padding: 15px;
  background: var(--bg-panel);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
}

.players-panel h3 {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.players-panel ul { list-style: none; }

.players-panel li {
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 0.85rem;
  background: var(--bg-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.players-panel li.dm {
  border-left: 3px solid var(--dm-purple);
  color: var(--text-primary);
}

.players-panel li:not(.dm) {
  border-left: 3px solid var(--accent-gold);
}

/* HP text in sidebar */
.players-panel li .hp {
  color: var(--accent-gold);
  font-weight: bold;
  font-size: 0.8rem;
}

/* --- Chat Area (Chronicle) --- */
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 15px;
  overflow-y: auto;
}

.chat-messages { flex: 1; overflow-y: auto; }

/* --- Messages --- */
.message {
  padding: 12px 14px;
  margin-bottom: 8px;
  border-radius: 6px;
  background: var(--bg-primary);
  border-left: 3px solid var(--accent-gold);
  line-height: 1.6;
}

.message.narrative { border-left-color: var(--accent-gold); }
.message.own { border-left-color: var(--player-green); }
.message.error { border-left-color: var(--error-red); background: #7f1d1d33; }
.message.roll { border-left-color: var(--dice-gold); }

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 0.8rem;
}

.message-header strong { color: var(--accent-gold); }
.message.narrative .message-header strong { color: var(--accent-gold); }
.message.own .message-header strong { color: var(--player-green); }
.message.roll .message-header strong { color: var(--dice-gold); }

.message-header .timestamp { color: var(--text-muted); font-size: 0.75rem; }
.message-content { font-size: 0.85rem; }

/* --- Stream Display (Typing Indicator) --- */
.stream-display {
  padding: 10px 14px;
  margin-bottom: 8px;
  border-radius: 6px;
  background: #c9a84c11;
  border: 1px dashed var(--accent-gold)33;
  min-height: 40px;
}

.stream-display .typing { color: var(--accent-gold); }
.stream-display .cursor { animation: blink 0.8s infinite; }

@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

/* ============================================================================
   Action Bar
   ============================================================================ */
.action-bar {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.preset-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
}

.dynamic-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

/* Spell dropdown */
.spell-selector select {
  padding: 6px 12px;
  font-size: 0.85rem;
  border-radius: 16px;
  background: var(--bg-panel);
  color: var(--accent-gold);
  border: 1px solid #c9a84c55;
  cursor: pointer;
  min-width: 160px;
}

.spell-selector select:focus {
  outline: none;
  box-shadow: 0 0 8px #c9a84c22;
}

/* Free text input */
.free-text {
  display: flex;
  gap: 8px;
  align-items: center;
}

.free-text input {
  padding: 8px 14px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.95rem;
  min-width: 200px;
}

.free-text input:focus {
  outline: none;
  border-color: var(--accent-gold);
  box-shadow: 0 0 8px #c9a84c22;
}

/* ============================================================================
   DM Panel
   ============================================================================ */
.dm-panel {
  width: 300px;
  padding: 15px;
  background: var(--bg-panel);
  border-left: 1px solid var(--border-color);
  overflow-y: auto;
}

/* ============================================================================
   Settings Modal
   ============================================================================ */
.settings-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
}

.settings-panel {
  position: relative;
  background: var(--bg-primary);
  border: 2px solid var(--accent-gold);
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideIn 0.3s ease;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.settings-header h3 {
  color: var(--accent-gold);
  font-size: 1.2rem;
}

.close-btn {
  background: none !important;
  border: none !important;
  color: var(--text-muted) !important;
  font-size: 1.2rem !important;
  cursor: pointer !important;
  padding: 4px 8px !important;
}

.close-btn:hover { color: var(--text-primary) !important; }

.settings-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.settings-result {
  margin-top: 12px;
  padding: 10px;
  border-radius: 6px;
  font-size: 0.9rem;
  text-align: center;
}

.settings-result.success {
  background: #064e3b;
  color: var(--player-green);
}

.settings-result.error {
  background: #7f1d1d;
  color: #fca5a5;
}

/* ============================================================================
   Notifications (Toast)
   ============================================================================ */
.notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 0.9rem;
  z-index: 1000;
  animation: slideIn 0.3s ease;
}

.notification-success { background: #064e3b; color: var(--player-green); }
.notification-error { background: #7f1d1d; color: #fca5a5; }
.notification-info { background: #1e3a5f; color: #93c5fd; }

@keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

/* ============================================================================
   HP Progress Bar (in players panel)
   ============================================================================ */
.hp-bar-container {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.hp-bar-track {
  flex: 1;
  background: var(--bg-primary);
  border-radius: 4px;
  height: 8px;
  overflow: hidden;
}

.hp-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-gold), var(--accent-gold-light));
  border-radius: 4px;
  transition: width 0.3s ease;
}

.hp-bar-fill.low {
  background: linear-gradient(90deg, var(--error-red), #ef4444);
}

.players-panel li .hp-text {
  color: var(--accent-gold);
  font-weight: bold;
  font-size: 0.8rem;
  white-space: nowrap;
  min-width: 52px;
  text-align: right;
}
```

- [ ] **Step 2: Verify CSS compiles (Vite doesn't need compilation for .css, but check no syntax errors)**

Run: `npx vite build --mode production` (frontend only)

Expected: Frontend builds cleanly. If there's a CSS error, fix it and run again. Note: this also runs the backend TypeScript compiler since npm run build does both — we'll verify that separately in Task 3.

- [ ] **Step 3: Commit**

```bash
git add public/css/style.css
git commit -m "style: rewrite CSS with Parchment & Ink theme — gold accents, pill buttons, HP bars, warm brown palette"
```

---

### Task 2: Add HP progress bar rendering to app.ts

**Files:**
- Modify: `public/js/app.ts` — update the `renderHP()` method (lines 265-276) and the game UI HTML template (lines 195-223)

The current renderHP() only updates text. We need to add an HTML progress bar element alongside the HP text in player cards, and ensure it gets re-rendered on every state change.

- [ ] **Step 1: Replace the game UI template to include HP bar containers**

Read `public/js/app.ts`. Find lines 207-212 which render player list items:
```ts
<li class="${p.isDM ? "dm" : ""}">
  ${p.isDM ? "👑 " : ""}${this.escapeHtml(p.name)} (${this.escapeHtml(p.characterName)})
  ${p.hp !== undefined ? `<span class="hp">${p.hp}/${p.maxHp}</span>` : ""}
</li>
```

Replace with:
```ts
<li class="${p.isDM ? "dm" : ""}">
  <div class="hp-bar-container">
    <span style="flex:1; font-size:0.85rem;">${p.isDM ? "👑 " : ""}${this.escapeHtml(p.name)}</span>
    ${p.hp !== undefined && p.maxHp > 0 ? `
      <div class="hp-bar-track">
        <div class="hp-bar-fill" style="width:${Math.round((p.hp / p.maxHp) * 100)}%;${p.hp <= Math.round(p.maxHp * 0.2) ? 'background:linear-gradient(90deg,#dc2626,#ef4444)' : ''}"></div>
      </div>
      <span class="hp-text">${p.hp}/${p.maxHp}</span>
    ` : `<span class="hp-text">—</span>`}
  </div>
</li>
```

- [ ] **Step 2: Replace the renderHP() method**

Find lines 265-276 which currently update HP text only. Replace with:
```ts
private renderHP(): void {
  const list = document.getElementById("players-list");
  if (!list || !gameState.game) return;
  const items = list.querySelectorAll("li");
  items.forEach((item, i) => {
    const player = gameState.game!.players[i];
    if (player?.hp !== undefined && player.maxHp > 0) {
      const fill = item.querySelector(".hp-bar-fill") as HTMLElement;
      const text = item.querySelector(".hp-text") as HTMLElement;
      if (fill) {
        const pct = Math.round((player.hp / player.maxHp) * 100);
        fill.style.width = `${pct}%`;
        if (player.hp <= Math.round(player.maxHp * 0.2)) {
          fill.style.background = "linear-gradient(90deg,#dc2626,#ef4444)";
        } else {
          fill.style.background = ""; // revert to CSS default gradient
        }
      }
      if (text) text.textContent = `${player.hp}/${player.maxHp}`;
    }
  });
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: `(no output)` — zero errors. The new DOM queries use `as HTMLElement` casts which match existing patterns in the file.

If any error, fix type mismatches. Run again until clean.

- [ ] **Step 4: Verify full build**

Run: `npm run build`

Expected: Backend compiles successfully + frontend builds cleanly. No errors.

- [ ] **Step 5: Commit**

```bash
git add public/js/app.ts
git commit -m "feat: add HP progress bars to player cards — gradient fill, low-HP warning at <20%"
```

---

### Task 3: Final verification — build + type check + visual sanity

**Files:** No file changes — runtime verification only.

- [ ] **Step 1: Check syntax of compiled output**

Run: `node --check dist/src/server.js`

Expected: `(no output)` — syntax valid.

- [ ] **Step 2: Run full build one final time**

Run: `npm run build`

Expected: Backend + frontend compile cleanly. No errors in either phase.

- [ ] **Step 3: Verify git status is clean (all changes committed)**

Run: `git status --short`

Expected: Only untracked files like node_modules entries or .superpowers/brainstorm/. No modified tracked files.

- [ ] **Step 4: Commit if anything left**

If `git status --short` shows any staged but not committed files, run:
```bash
git add -A && git commit -m "style: complete Parchment & Ink theme — final cleanup"
```

Otherwise skip.

---

## Self-Review

**Spec coverage:**
| Spec Section | Implementation Task |
|-------------|---------------------|
| Color palette (8 custom properties) | Task 1 Step 1 — `:root` block with all hex values |
| Welcome screen styling | Task 1 Step 1 — `.welcome-screen`, forms, inputs, buttons |
| Scenario cards (hover/selected glow) | Task 1 Step 1 — `.scenario-card:hover/.selected` with gold borders + box-shadow |
| Game header (gold divider) | Task 1 Step 1 — `.game-header` border-bottom: `var(--gold-subtle)` |
| Party sidebar (player cards, DM purple) | Task 1 Step 1 — `.players-panel li.dm` with purple left border, non-DM gold |
| HP progress bars (gradient + low warning) | Task 2 Step 1+2 — HTML injection in game UI template + renderHP() updates |
| Chronicle chat messages (styled cards) | Task 1 Step 1 — `.message` with line-height 1.6, role-colored headers |
| Dice roll messages (gold border) | Task 1 Step 1 — `.message.roll` with `--dice-gold` left border + header color |
| Action bar pill buttons | Task 1 Step 1 — `.preset-btn`, `.action-item-btn` with border-radius: 16px |
| Potion buttons (green theme) | Task 1 Step 1 — `.potion-btn` with #064e3b fill, #4ade80 text |
| Spell dropdown (gold border) | Task 1 Step 1 — `.spell-selector select` with `#c9a84c55` border |
| Settings modal (gold border, rounded) | Task 1 Step 1 — `.settings-panel` with gold border + dark brown fill |
| Notifications (toast styling) | Task 1 Step 1 — `.notification-*` classes with theme colors |

All spec sections covered. No gaps.

**Placeholder scan:**
- ✅ All CSS values explicit — no `/* TODO */`, no "add later" comments
- ✅ HP bar gradient direction specified (90deg left-to-right), low threshold at 20%
- ✅ All selectors match actual DOM classes from character.ts, app.ts, action-bar.ts
- ✅ Exact code in every step — renderHP() replacement shown with full method body

**Type consistency:**
- `public/js/app.ts` uses `as HTMLElement` casts for DOM queries — matches existing pattern (e.g., line 140: `as HTMLInputElement`)
- CSS custom properties referenced consistently via `var(--name)` throughout
- No conflicting class names introduced (`.hp-bar-container`, `.hp-bar-fill`, `.hp-text` are new, don't collide with existing `.hp`)

**Scope check:**
- Single CSS file rewrite + one JS method update in app.ts
- No backend changes, no TypeScript type changes
- No layout structure changes — flex/grid preserved from original
- Scope is appropriate for a single implementation cycle
