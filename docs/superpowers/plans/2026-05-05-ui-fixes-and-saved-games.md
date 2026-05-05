# UI Fixes & Saved Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix i18n missing keys, DM control panel layout overlap, player level localization, and add saved games loading from the welcome screen.

**Architecture:** Add missing translation keys across all locales, restructure DM controls to toggle-only (removing inline buttons), replace hardcoded "Lv." with localized key, add `GET /api/saved-games` backend endpoint, and render saved game cards on the welcome page.

**Tech Stack:** Node.js + TypeScript + Express + Vite + Zod + ws

---

### Task 1: Add Missing i18n Translation Keys

**Files:**
- Modify: `locales/en-US.json:237` (append before closing brace)
- Modify: `locales/zh-CN.json:559` (append before closing brace)
- Modify: `locales/ja-JP.json:176` (append before closing brace)
- Modify: `locales/es-ES.json:176` (append before closing brace)
- Modify: `locales/ko-KR.json:176` (append before closing brace)

**Context:** The button `t("npc.create_btn")` is called in `app.ts:660` but no translation key exists.

- [ ] **Step 1: Add `npc.create_btn` to en-US.json**

In `locales/en-US.json`, append after line 237 (`"item.type_misc": "Misc"`):
```json
  "npc.create_btn": "Create NPC",
```

- [ ] **Step 2: Add `npc.create_btn` to zh-CN.json**

In `locales/zh-CN.json`, append after line 559 (`"dm_control.player_leveled": "{playerName} 升级到 {level} 级"`):
```json
  "npc.create_btn": "创建NPC",
```

- [ ] **Step 3: Add `npc.create_btn` to ja-JP.json**

In `locales/ja-JP.json`, append after line 176 (`"player_joined.notification": "{name} が冒険に参加しました！"`):
```json
  "npc.create_btn": "NPC作成",
```

- [ ] **Step 4: Add `npc.create_btn` to es-ES.json**

In `locales/es-ES.json`, append after line 176 (`"player_joined.notification": "¡{name} se ha unido a la aventura!"`):
```json
  "npc.create_btn": "Crear NPC",
```

- [ ] **Step 5: Add `npc.create_btn` to ko-KR.json**

In `locales/ko-KR.json`, append after line 176 (`"player_joined.notification": "{name}이(가) 모험에 참가했습니다!"`):
```json
  "npc.create_btn": "NPC 생성",
```

- [ ] **Step 6: Verify JSON syntax**

Run: `node --check -e "JSON.parse(require('fs').readFileSync('locales/en-US.json','utf8'))"` 
Expected: no error

Run same for each locale file.

- [ ] **Step 7: Commit**

```bash
git add locales/
git commit -m "fix(i18n): add missing npc.create_btn translation key to all locales"
```

---

### Task 2: Fix Player Level Localization (Hardcoded "Lv.")

**Files:**
- Modify: `public/js/app.ts:627`

**Context:** Line 627 hardcodes `" Lv.${p.level}"` instead of using the localized key.

- [ ] **Step 1: Replace hardcoded "Lv." with t("level.abbreviation")**

In `public/js/app.ts`, find line 627:
```ts
<span class="player-detail">${this.escapeHtml(p.race)} ${this.escapeHtml(p.characterClass)} Lv.${p.level}</span>
```

Replace with:
```ts
<span class="player-detail">${this.escapeHtml(p.race)} ${this.escapeHtml(p.characterClass)} ${t("level.abbreviation")}${p.level}</span>
```

- [ ] **Step 2: Verify no other hardcoded "Lv." in app.ts**

Run: `rg "Lv\." public/js/app.ts`
Expected: No matches (the t("level.abbreviation") usage is fine)

- [ ] **Step 3: Commit**

```bash
git add public/js/app.ts
git commit -m "fix(i18n): replace hardcoded 'Lv.' with localized level.abbreviation key"
```

---

### Task 3: Fix DM Control Panel Layout (Remove Inline Buttons)

**Files:**
- Modify: `public/js/app.ts:657-662` (remove inline DM buttons from showGameUI)
- Modify: `public/js/app.ts:684` (remove setupDMControls call since buttons are gone)

**Context:** Lines 657-662 render two inline buttons (`#start-combat-btn`, `#create-npc-btn`) inside the `.game-interface` div. These fixed-position buttons overlap with the main game content. The DM should use only the toggle button (`#dm-control-toggle`) to open the expanded panel.

- [ ] **Step 1: Remove inline DM control buttons from showGameUI**

In `public/js/app.ts`, find lines 657-662 in the `showGameUI()` template:
```ts
        <!-- DM Control Panel (only visible to DM) -->
        ${player.isDM ? `
          <div class="dm-control-panel">
            <button id="start-combat-btn" class="primary">${t("combat.start")}</button>
            <button id="create-npc-btn" class="secondary">${t("npc.create_btn")}</button>
          </div>
        ` : ''}
```

Replace with:
```ts
        <!-- DM Control Panel (only visible to DM) -->
        ${player.isDM ? `<div class="dm-control-panel hidden" id="dm-expanded-panel"></div>` : ''}
```

- [ ] **Step 2: Remove setupDMControls call**

In `public/js/app.ts`, find line 684:
```ts
    this.setupDMControls();
```

Remove this line entirely. The combat start and NPC create buttons will now only exist inside the expanded DM panel, which is handled by `setupDMControlPanelToggle()`.

- [ ] **Step 3: Add button handlers to renderDMControlPanel**

In `public/js/app.ts`, find the end of `renderDMControlPanel()` method (around line 1289, after `this.attachDMControlHandlers()`). The expanded panel already has a create NPC form and the DM control panel toggle logic. We need to ensure the "Start Combat" button is added at the top of the expanded panel.

In `renderDMControlPanel()`, add these buttons at the very beginning of the panel's innerHTML (before the first `<div class="dm-control-section">`):

```ts
    // DM quick actions (always at top)
    const dmQuickActions = `
      <div class="dm-quick-actions">
        <button id="start-combat-btn" class="primary">${t("combat.start")}</button>
        <button id="create-npc-btn" class="secondary">${t("npc.create_btn")}</button>
      </div>
    `;
```

Then in the panel.innerHTML template, prepend this:
```ts
    panel.innerHTML = `
      ${dmQuickActions}
      <div class="dm-control-section">
        ...
```

- [ ] **Step 4: Ensure start-combat and create-npc buttons are wired in attachDMControlHandlers**

In `attachDMControlHandlers()`, add these handlers at the end:
```ts
    // Start Combat button
    const startCombatBtn = panel.querySelector("#start-combat-btn");
    if (startCombatBtn) {
      startCombatBtn.addEventListener("click", () => {
        wsManager.send("COMBAT_START", { startInitiative: true });
      });
    }

    // Create NPC button — opens the NPC creation form section
    const createNpcBtn = panel.querySelector("#create-npc-btn");
    if (createNpcBtn) {
      createNpcBtn.addEventListener("click", () => {
        // Focus the NPC form input for quick entry
        const npcNameInput = panel.querySelector<HTMLInputElement>('input[name="name"]');
        if (npcNameInput) {
          npcNameInput.focus();
          npcNameInput.placeholder = "Enter NPC name...";
        }
      });
    }
```

- [ ] **Step 5: Add CSS for dm-quick-actions**

In `public/css/style.css`, add after the `.dm-control-panel button.secondary:hover` rule (around line 1734):
```css
/* DM Quick Actions Bar */
.dm-quick-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--border-color);
}

.dm-quick-actions button {
  flex: 1;
  padding: 10px 16px;
  font-size: 0.9rem;
}
```

- [ ] **Step 6: Commit**

```bash
git add public/js/app.ts public/css/style.css
git commit -m "fix(ui): restructure DM controls to toggle-only panel, remove inline buttons"
```

---

### Task 4: Add Backend API for Saved Games List

**Files:**
- Modify: `src/server.ts` (add GET /api/saved-games route)
- Import: `listGames` from `../utils/storage.js`

**Context:** `storage.ts` already has a `listGames()` function that reads saved games from the `saved_games/` directory. We need an API endpoint to expose this to the frontend.

- [ ] **Step 1: Add import for listGames**

In `src/server.ts`, find the existing imports section. Add:
```ts
import { listGames as listSavedGames } from "./utils/storage.js";
```

- [ ] **Step 2: Add GET /api/saved-games route**

In `src/server.ts`, add after line 161 (`app.get("/api/games/:id/load", gamesLoadGetHandler);`):
```ts
// ---- Saved Games API Route ----

app.get("/api/saved-games", (_req, res) => {
  try {
    const saved = listSavedGames();
    res.json(saved);
  } catch (error) {
    console.error("[API] Failed to list saved games:", error);
    res.status(500).json({ error: "Failed to list saved games" });
  }
});
```

- [ ] **Step 3: Verify syntax**

Run: `node --check dist/src/server.js` (after build) or just run full build in Task 7.

- [ ] **Step 4: Commit**

```bash
git add src/server.ts
git commit -m "feat(api): add GET /api/saved-games endpoint for loading saved games from lobby"
```

---

### Task 5: Add Saved Games Section to Welcome Page

**Files:**
- Modify: `public/js/character.ts` (add saved games section in showForm)
- Add i18n keys: `locales/*.json` (saved_games section keys)

**Context:** The welcome page (`CharacterCreator.showForm()`) currently shows Active Games and Create Your Own Adventure. We need to add a "Saved Adventures" section between them.

- [ ] **Step 1: Add i18n keys for saved games section**

In all 5 locale files, add these keys before the closing brace:

For `en-US.json`:
```json
  "saved_games.title": "💾 Saved Adventures",
  "saved_games.loading": "Loading saved games...",
  "saved_games.empty": "No saved adventures yet. Save a game during play to see it here.",
  "saved_games.load_btn": "Load Game",
  "saved_games.date_format": "{date}",
```

For `zh-CN.json`:
```json
  "saved_games.title": "💾 存档冒险",
  "saved_games.loading": "加载存档中...",
  "saved_games.empty": "还没有存档。在游戏中保存后，这里会显示可用的存档。",
  "saved_games.load_btn": "加载游戏",
  "saved_games.date_format": "{date}",
```

For `ja-JP.json`:
```json
  "saved_games.title": "💾 保存された冒険",
  "saved_games.loading": "セーブデータを読み込み中...",
  "saved_games.empty": "まだセーブデータがありません。プレイ中にゲームを保存するとここに表示されます。",
  "saved_games.load_btn": "ロード",
  "saved_games.date_format": "{date}",
```

For `es-ES.json`:
```json
  "saved_games.title": "💾 Aventuras Guardadas",
  "saved_games.loading": "Cargando partidas guardadas...",
  "saved_games.empty": "Aún no hay partidas guardadas. Guarda una partida durante la jugabilidad para verla aquí.",
  "saved_games.load_btn": "Cargar Juego",
  "saved_games.date_format": "{date}",
```

For `ko-KR.json`:
```json
  "saved_games.title": "💾 저장된 모험",
  "saved_games.loading": "저장된 게임 로딩 중...",
  "saved_games.empty": "아직 저장된 게임이 없습니다. 플레이 중 게임을 저장하면 여기에 표시됩니다.",
  "saved_games.load_btn": "게임 로드",
  "saved_games.date_format": "{date}",
```

- [ ] **Step 2: Add saved games section to showForm() in character.ts**

In `public/js/character.ts`, modify the `showForm()` method. After the `<div class="active-games-section">` block (around line 114), insert a new saved games section:

```html
      <!-- Saved Games Section -->
      <div class="saved-games-section" id="saved-games-section" style="display:none;">
        <div class="section-header">
          <h2 class="section-title">${t("saved_games.title")}</h2>
        </div>
        <div id="saved-games-container"></div>
      </div>
```

And add the CSS class `.saved-games-section` styling (same as `.active-games-section`).

- [ ] **Step 3: Add fetchSavedGames method to CharacterCreator**

In `public/js/character.ts`, add a new method after `showForm()`:

```ts
  private async fetchSavedGames(): Promise<void> {
    try {
      const response = await fetch("/api/saved-games");
      if (!response.ok) return;
      const games: Array<{ id: string; name: string; createdAt: number }> = await response.json();
      this.renderSavedGames(games);
    } catch {
      // API not available yet — skip
    }
  }

  private renderSavedGames(games: Array<{ id: string; name: string; createdAt: number }>): void {
    const container = document.getElementById("saved-games-container");
    if (!container) return;

    if (games.length === 0) {
      container.innerHTML = `<p class="no-games">${t("saved_games.empty")}</p>`;
      return;
    }

    container.innerHTML = games.map(g => {
      const dateStr = new Date(g.createdAt).toLocaleDateString();
      return `
        <div class="game-card saved-game" data-saved-id="${this.escapeHtml(g.id)}">
          <div class="game-card-header">
            <span class="scenario-badge">💾</span>
            <h3>${this.escapeHtml(g.name)}</h3>
          </div>
          <div class="game-card-body">
            <span class="game-scenario-label">${t("saved_games.date_format", { date: dateStr })}</span>
            <button class="join-game-btn load-saved-btn" data-saved-id="${this.escapeHtml(g.id)}">
              ${t("saved_games.load_btn")}
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Attach load handlers
    container.querySelectorAll(".load-saved-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const savedId = (btn as HTMLElement).getAttribute("data-saved-id");
        if (savedId) {
          window.location.href = `?game=${savedId}`;
        }
      });
    });
  }
```

- [ ] **Step 4: Call fetchSavedGames in showForm()**

At the end of `showForm()`, after fetching active games, add:
```ts
    // Fetch saved games on load
    this.fetchSavedGames();
```

- [ ] **Step 5: Show saved games section only when there are results**

In `renderSavedGames()`, after rendering (whether empty or with games), make the container visible:
```ts
    const section = document.getElementById("saved-games-section");
    if (section) section.style.display = "block";
```

- [ ] **Step 6: Add CSS for saved games section**

In `public/css/style.css`, add after `.active-games-section` rules (around line 125):
```css
.saved-games-section {
  padding: 30px 20px 40px;
  max-width: 800px;
  margin: 0 auto;
}

.game-card.saved-game .scenario-badge {
  background: rgba(212, 168, 67, 0.15);
}
```

- [ ] **Step 7: Commit**

```bash
git add public/js/character.ts public/css/style.css locales/
git commit -m "feat(ui): add saved games section to welcome page with load-from-lobby flow"
```

---

### Task 6: Build, Test, and Verify

**Files:**
- Run: `npm run build`
- Run: `npx vitest run`
- Run: `npx tsc --noEmit`

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Backend tsc + Frontend Vite build both succeed without errors

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: Exit code 0, no type errors

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All existing tests pass (179 tests)

- [ ] **Step 4: Commit all remaining changes**

```bash
git add -A
git commit -m "feat(ui): complete UI fixes — i18n, DM panel layout, saved games loading"
```

- [ ] **Step 5: Push to remote**

Run: `git push origin main`
Expected: All commits pushed successfully

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Issue 1 (npc.create_btn i18n) → Task 1
- ✅ Issue 2 (DM panel overlap) → Task 3
- ✅ Issue 3 (hardcoded "Lv.") → Task 2
- ✅ Issue 4 (saved games from lobby) → Tasks 4 + 5

**Placeholder scan:** No TBD, TODO, or "similar to" references found.

**Type consistency:** All file paths and method names match across tasks. `fetchSavedGames` and `renderSavedGames` are defined in Task 5 step 3 and called in step 4.

**Edge cases handled:**
- Empty saved games list → shows message, section still visible
- API unavailable → graceful skip with try/catch
- Saved game ID passed via URL param → triggers existing join flow (no new WS handler needed)
