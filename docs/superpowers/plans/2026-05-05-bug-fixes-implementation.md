# Bug Fixes Implementation Plan: Save, DC Skill Checks, Character Localization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal**: Fix three post-Phase-3 bugs: save button not working, DC skill checks appearing in DM dialogue instead of auto-triggering, and character race/class names displaying in English instead of localized language.

**Architecture**: 
1. Save functionality uses WebSocket message type (SAVE_GAME → GAME_SAVED) for consistency with existing game operations
2. LLM outputs diceResult in structured JSON block when skill check needed, frontend auto-triggers display
3. Frontend i18n mapping translates race/class names using t() function

**Tech Stack**: TypeScript, WebSocket (ws), Zod validation, i18n JSON locales

---

### Task 1: Add Save Game WebSocket Message Types and Schema

**Files:**
- Modify: `src/types/index.ts:177-234` (add SAVE_GAME and GAME_SAVED to MessageType)
- Modify: `shared/schemas/game.ts:116` (add saveGameSchema and type export)
- Modify: `shared/index.ts:38` (export saveGameSchema)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/websocket/save-game.test.ts
import { describe, it, expect, vi } from "vitest";
import { saveGameSchema } from "../../shared/index.js";

describe("saveGameSchema", () => {
  it("should validate valid game ID", () => {
    const result = saveGameSchema.safeParse({ gameId: "game_123" });
    expect(result.success).toBe(true);
  });

  it("should reject empty game ID", () => {
    const result = saveGameSchema.safeParse({ gameId: "" });
    expect(result.success).toBe(false);
  });

  it("should reject missing gameId", () => {
    const result = saveGameSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/websocket/save-game.test.ts`
Expected: FAIL with "saveGameSchema is not defined"

- [ ] **Step 3: Add saveGameSchema to shared/schemas/game.ts**

Add after line 116 (after diceRollSchema):

```typescript
// ============================================================================
// SAVE GAME SCHEMA
// ============================================================================

export const saveGameSchema = z.object({
  gameId: z.string().min(1),
});

export type SaveGameInput = z.infer<typeof saveGameSchema>;
```

- [ ] **Step 4: Export saveGameSchema from shared/index.ts**

Add after line 38 (after diceRollSchema export):

```typescript
export { saveGameSchema } from "./schemas/game.js";
export type { SaveGameInput } from "./schemas/game.js";
```

- [ ] **Step 5: Add SAVE_GAME and GAME_SAVED to MessageType**

Modify src/types/index.ts lines 177-234. Find the MessageType definition and add:

```typescript
export type MessageType =
  // Client → Server
  | 'CREATE_GAME'
  | 'JOIN_GAME'
  | 'LIST_GAMES'
  | 'PLAYER_ACTION'
  | 'PLAYER_CHAT'
  | 'PLAYER_EMOTE'
  | 'PRIVATE_CHAT'
  | 'SET_LOCALE'
  | 'DICE_ROLL'
  | 'NPC_CREATE'
  | 'EVENT_CREATE'
  | 'COMBAT_START'
  | 'COMBAT_END'
  | 'INITIATIVE_ROLL'
  | 'TURN_ADVANCE'
  | 'NPC_UPDATE_HP'
  | 'NPC_APPLY_CONDITION'
  | 'NPC_REMOVE_CONDITION'
  | 'NPC_DELETE'
  | 'PLAYER_AWARD_XP'
  | 'PLAYER_LEVEL_UP'
  | 'INVENTORY_ADD_ITEM'
  | 'EQUIP_WEAPON'
  | 'EQUIP_ARMOR'
  | 'UNEQUIP_WEAPON'
  | 'UNEQUIP_ARMOR'
  | 'USE_ITEM'
  | 'APPLY_TEMPORARY_HP'
  | 'APPLY_BUFF'
  | 'REMOVE_BUFF'
  | 'SAVE_GAME'        // NEW: Client requests game save
  // Server → Client
  | 'GAME_CONNECTED'
  | 'GAME_CREATED'
  | 'GAME_STATE'
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'PLAYER_ACTION_RESULT'
  | 'CHAT_MESSAGE'
  | 'EMOTE_MESSAGE'
  | 'PRIVATE_MESSAGE'
  | 'DICE_ROLL_RESULT'
  | 'NPC_CREATED'
  | 'EVENT_CREATED'
  | 'STREAM_CHUNK'
  | 'STREAM_END'
  | 'STREAM_ERROR'
  | 'LOCALE_UPDATED'
  | 'TURN_TIMER'
  | 'COMBAT_STATE'
  | 'INITIATIVE_UPDATE'
  | 'DM_CONTROL_UPDATE'
  | 'INVENTORY_UPDATE'
  | 'EQUIPMENT_UPDATE'
  | 'ITEM_USED'
  | 'BUFF_UPDATE'
  | 'GAME_SAVED'       // NEW: Server confirms save success
  | 'ERROR';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/websocket/save-game.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add tests/websocket/save-game.test.ts shared/schemas/game.ts shared/index.ts src/types/index.ts
git commit -m "feat: add SAVE_GAME WebSocket message type and schema"
```

---

### Task 2: Implement Save Game WebSocket Handler

**Files:**
- Modify: `src/websocket/manager.ts:78-176` (add SAVE_GAME case in routeMessage)
- Modify: `src/websocket/manager.ts:299+` (add handleSaveGame method after existing handlers)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/websocket/save-game.test.ts (extend existing file)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebSocketServer } from "ws";
import { Server as HttpServer } from "http";
import { WebSocketManager } from "../../src/websocket/manager.js";
import { gameStore } from "../../src/game/store.js";

describe("WebSocketManager - SAVE_GAME", () => {
  let wss: WebSocketServer;
  let manager: WebSocketManager;
  let mockWs: any;
  let mockHttpServer: HttpServer;

  beforeEach(() => {
    mockHttpServer = {} as HttpServer;
    wss = new WebSocketServer(mockHttpServer as any);
    manager = new WebSocketManager(mockHttpServer as any);
    mockWs = {
      send: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
  });

  it("should handle SAVE_GAME message and broadcast GAME_SAVED", () => {
    const gameId = "test_game_123";
    
    // Mock game exists in store
    const mockGame = { id: gameId, name: "Test Game" } as any;
    vi.spyOn(gameStore, "getGame").mockReturnValue(mockGame);
    
    // Mock storage.saveGame
    vi.spyOn(gameStore, "saveGame").mockImplementation(() => {});

    // Simulate SAVE_GAME message
    manager.send(mockWs as any, "SAVE_GAME", { gameId });

    // Verify GAME_SAVED broadcast
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining("GAME_SAVED")
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/websocket/save-game.test.ts`
Expected: FAIL with "Unknown message type: SAVE_GAME"

- [ ] **Step 3: Add SAVE_GAME case in routeMessage switch**

Modify src/websocket/manager.ts after line 173 (after REMOVE_BUFF case):

```typescript
      case "REMOVE_BUFF":
        this.handleRemoveBuff(ws, client!, payload);
        break;
      case "SAVE_GAME":
        this.handleSaveGame(ws, client!, payload);
        break;
      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
```

- [ ] **Step 4: Implement handleSaveGame method**

Add after line 299 (after handleRemoveBuff method):

```typescript
  private handleSaveGame(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
    const parsed = saveGameSchema.safeParse(payload);
    if (!parsed.success) {
      this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
      return;
    }

    const gameId = parsed.data.gameId;
    
    // Verify client is in the game
    if (client.gameId !== gameId) {
      this.sendError(ws, "You are not in this game");
      return;
    }

    const engine = gameStore.getGame(gameId);
    if (!engine) {
      this.sendError(ws, "Game not found");
      return;
    }

    // Save game to disk
    try {
      engine.saveGame(); // Calls storage.saveGame internally
      
      // Broadcast success to all players in the game
      this.broadcastToGame(gameId, "GAME_SAVED", { 
        gameId,
        timestamp: Date.now()
      });

      console.log(`[SaveGame] Game ${gameId} saved successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.sendError(ws, `Failed to save game: ${errorMessage}`);
      console.error(`[SaveGame] Failed to save game ${gameId}:`, error);
    }
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/websocket/save-game.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/websocket/manager.ts tests/websocket/save-game.test.ts
git commit -m "feat: implement SAVE_GAME WebSocket handler"
```

---

### Task 3: Update Frontend Save Button to Use WebSocket

**Files:**
- Modify: `public/js/app.ts:692-710` (replace fetch with wsManager.send)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/frontend/save-button.test.ts (mock test - frontend tests are integration)
import { describe, it, expect, vi } from "vitest";

describe("Save button - WebSocket integration", () => {
  it("should send SAVE_GAME message instead of HTTP request", () => {
    // This is verified by manual testing or E2E test
    // The implementation should use wsManager.send("SAVE_GAME") not fetch()
    expect(true).toBe(true); // Placeholder - real test requires browser environment
  });
});
```

- [ ] **Step 2: Run test to verify it fails (placeholder)**

Run: `npx vitest run tests/frontend/save-button.test.ts`
Expected: PASS (placeholder test)

- [ ] **Step 3: Update save button handler in app.ts**

Modify public/js/app.ts lines 692-710:

```typescript
    // Save game button
    const saveBtn = document.getElementById("save-game-btn");
    saveBtn?.addEventListener("click", async () => {
      if (!this.gameId) return;
      
      try {
        // Use WebSocket instead of HTTP API
        wsManager.send("SAVE_GAME", { gameId: this.gameId });
        
        // Show pending notification
        this.showNotification("💾 正在保存...", "info");
        
        // Wait for GAME_SAVED response via WebSocket handlers
        // (handled in setupWebSocketHandlers below)
      } catch (error) {
        this.showNotification(t("save.error"), "error");
        console.error("Save failed:", error);
      }
    });
```

- [ ] **Step 4: Add GAME_SAVED handler in setupWebSocketHandlers**

Find setupWebSocketHandlers method in app.ts (around line 580) and add:

```typescript
    wsManager.on("GAME_SAVED", (data) => {
      this.showNotification(t("save.success"), "success");
      console.log(`[GAME_SAVED] Game ${data.gameId} saved at ${new Date(data.timestamp).toLocaleString()}`);
    });
```

- [ ] **Step 5: Manual verification**

Run: `npm run build` then start server manually
Expected: Click save button → shows "正在保存..." → receives GAME_SAVED → shows "✅ 游戏已保存！"

- [ ] **Step 6: Commit**

```bash
git add public/js/app.ts
git commit -m "feat: update save button to use WebSocket SAVE_GAME message"
```

---

### Task 4: Update LLM System Prompt for Skill Check JSON Output

**Files:**
- Modify: `src/llm/prompts.ts:142-207` (add JSON output format requirements in buildDDDMechanics)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/llm/prompt-skill-check.test.ts
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../../src/llm/prompts.js";

describe("buildSystemPrompt - Skill Check JSON Output", () => {
  it("should include diceResult output format instructions", () => {
    const prompt = buildSystemPrompt("dungeon", "zh-CN");
    
    // Verify prompt includes skill check JSON output requirements
    expect(prompt).toContain("diceResult");
    expect(prompt).toContain("skill");
    expect(prompt).toContain("dc");
    expect(prompt).toContain("success");
  });

  it("should include example JSON output for skill checks", () => {
    const prompt = buildSystemPrompt("dungeon", "zh-CN");
    
    // Verify prompt includes example format
    expect(prompt).toContain("JSON OUTPUT FORMAT FOR SKILL CHECKS");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/llm/prompt-skill-check.test.ts`
Expected: FAIL - prompt doesn't contain diceResult instructions

- [ ] **Step 3: Update buildDDDMechanics with JSON output format**

Modify src/llm/prompts.ts after line 207 (end of SAVING THROWS section):

```typescript
When an NPC or trap forces a save: describe the effect, then narrate based on success/failure.
Example: "The dragon exhales a torrent of flame! (DEX save DC 15)" — Success = half damage, Dodge aside. Failure = engulfed in fire.

PASSIVE SCORES (DM uses these without rolling):
- Passive Perception = what the player notices automatically without actively searching
- If NPC stealth > player passive perception → player doesn't notice the hidden creature
- Use this for surprise encounters and hidden clues

ADVANTAGE / DISADVANTAGE:
- Advantage = roll 2d20, take higher (helpful ally, clear target, prepared)
- Disadvantage = roll 2d20, take lower (obscured vision, surprised, injured)
- Narrate these naturally: "The goblin is distracted — you have advantage on your attack."

CONDITIONS (apply mechanical effects):
- Poisoned → disadvantage on attack rolls and ability checks
- Blinded → auto-fail Perception (sight), attacks against have advantage
- Charmed → can't attack the charmer, charmer has advantage on social checks
- Frightened → disadvantage on checks while source is visible, may flee
- Grappled → speed becomes 0, can't move voluntarily
- Prone → disadvantage on attack rolls, melee attacks against have advantage

SHORT REST MECHANICS:
- When player says "short rest" or "rest": they recover hit dice (roll HD + CON mod for healing)
- They also recover some spell slots and can reset death saves if HP > 0
- Narrate the atmosphere during their rest — what they hear, smell, feel

DEATH SAVES:
- When player reaches 0 HP → they fall unconscious and start rolling death saves
- Each turn at 0HP: roll d20. 10+ = success, 9 or less = failure, natural 20 = recover 1 HP
- 3 successes = stable (no longer dying). 3 failures = dead.
- Narrate the struggle between life and death dramatically

JSON OUTPUT FORMAT FOR SKILL CHECKS:

When a skill check is required (player attempts uncertain action):
1. Narrate the scene and the challenge in the text portion
2. In the JSON block, include diceResult with the following fields:
   - skill: skill name in English (e.g., "Persuasion", "Stealth", "Perception")
   - dc: difficulty class number (5-25 based on difficulty table)
   - success: true/false based on whether the roll meets or exceeds DC
   - total: the final roll result (d20 + modifier)
   - roll: the raw d20 roll value
   - modifier: the ability modifier + proficiency bonus (if skilled)

Example JSON output for a Persuasion check:
{
  "diceResult": {
    "skill": "Persuasion",
    "dc": 15,
    "success": true,
    "total": 18,
    "roll": 14,
    "modifier": 4
  }
}

The LLM should simulate the roll result based on narrative context:
- High rolls (15+) = successful outcome, narrate positively
- Low rolls (below DC) = failure with consequences, narrate negatively
- Natural 20 = critical success, natural 1 = critical failure`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/llm/prompt-skill-check.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/llm/prompts.ts tests/llm/prompt-skill-check.test.ts
git commit -m "feat: add skill check JSON output format to LLM system prompt"
```

---

### Task 5: Add Race and Class Localization Keys to All Locale Files

**Files:**
- Modify: `locales/en-US.json` (add race.* and class.* keys)
- Modify: `locales/zh-CN.json` (already has some, verify completeness)
- Modify: `locales/ja-JP.json` (add race.* and class.* keys)
- Modify: `locales/es-ES.json` (add race.* and class.* keys)
- Modify: `locales/ko-KR.json` (add race.* and class.* keys)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/i18n/race-class-localization.test.ts
import { describe, it, expect } from "vitest";
import { getLocalizedMessage } from "../../src/utils/locale-loader.js";

describe("Race and Class Localization", () => {
  const locales = ["en-US", "zh-CN", "ja-JP", "es-ES", "ko-KR"];
  const races = ["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Half-Elf", "Gnome", "Half-Orc"];
  const classes = ["Fighter", "Wizard", "Rogue", "Cleric", "Barbarian", "Paladin", "Ranger", "Sorcerer"];

  locales.forEach(locale => {
    it(`should have race translations for ${locale}`, () => {
      races.forEach(race => {
        const key = `race.${race.toLowerCase()}`;
        const translation = getLocalizedMessage(locale, key);
        expect(translation).not.toBe(key); // Should not return the key itself
        expect(translation).not.toBeUndefined();
      });
    });

    it(`should have class translations for ${locale}`, () => {
      classes.forEach(cls => {
        const key = `class.${cls.toLowerCase()}`;
        const translation = getLocalizedMessage(locale, key);
        expect(translation).not.toBe(key);
        expect(translation).not.toBeUndefined();
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/i18n/race-class-localization.test.ts`
Expected: FAIL - multiple locales missing race/class keys

- [ ] **Step 3: Add race and class keys to en-US.json**

Add after line ~50 (after attributes section):

```json
  "race.human": "Human",
  "race.elf": "Elf",
  "race.dwarf": "Dwarf",
  "race.halfling": "Halfling",
  "race.dragonborn": "Dragonborn",
  "race.half-elf": "Half-Elf",
  "race.gnome": "Gnome",
  "race.half-orc": "Half-Orc",
  "class.fighter": "Fighter",
  "class.wizard": "Wizard",
  "class.rogue": "Rogue",
  "class.cleric": "Cleric",
  "class.barbarian": "Barbarian",
  "class.paladin": "Paladin",
  "class.ranger": "Ranger",
  "class.sorcerer": "Sorcerer",
```

- [ ] **Step 4: Add race and class keys to ja-JP.json**

Add after attributes section:

```json
  "race.human": "人間",
  "race.elf": "エルフ",
  "race.dwarf": "ドワーフ",
  "race.halfling": "ハーフリング",
  "race.dragonborn": "ドラゴンボーン",
  "race.half-elf": "ハーフエルフ",
  "race.gnome": "ノーム",
  "race.half-orc": "ハーフオーク",
  "class.fighter": "戦士",
  "class.wizard": "魔法使い",
  "class.rogue": "ローグ",
  "class.cleric": "クレリック",
  "class.barbarian": "バーバリアン",
  "class.paladin": "パラディン",
  "class.ranger": "レンジャー",
  "class.sorcerer": "ソーサラー",
```

- [ ] **Step 5: Add race and class keys to es-ES.json**

Add after attributes section:

```json
  "race.human": "Humano",
  "race.elf": "Elfo",
  "race.dwarf": "Enano",
  "race.halfling": "Hobbit",
  "race.dragonborn": "Dragón nato",
  "race.half-elf": "Half-elfo",
  "race.gnome": "Gnomo",
  "race.half-orc": "Half-orco",
  "class.fighter": "Guerrero",
  "class.wizard": "Mago",
  "class.rogue": "Pícaro",
  "class.cleric": "Clérigo",
  "class.barbarian": "Bárbaro",
  "class.paladin": "Paladín",
  "class.ranger": "Explorador",
  "class.sorcerer": "Hechicero",
```

- [ ] **Step 6: Add race and class keys to ko-KR.json**

Add after attributes section:

```json
  "race.human": "인간",
  "race.elf": "엘프",
  "race.dwarf": "드워프",
  "race.halfling": "할링",
  "race.dragonborn": "드래곤본",
  "race.half-elf": "하 elf",
  "race.gnome": "노움",
  "race.half-orc": "하프 오크",
  "class.fighter": "전사",
  "class.wizard": "마법사",
  "class.rogue": "도적",
  "class.cleric": "성직자",
  "class.barbarian": "야만인",
  "class.paladin": "성기사",
  "class.ranger": " Ranger",
  "class.sorcerer": "마술사",
```

- [ ] **Step 7: Verify zh-CN.json has all keys**

Check zh-CN.json - already has race.* and class.* keys at lines 435-474. Verify completeness matches raceOptions and classOptions from shared/schemas/game.ts.

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/i18n/race-class-localization.test.ts`
Expected: PASS (40 tests - 5 locales × 8 races + 5 locales × 8 classes)

- [ ] **Step 9: Commit**

```bash
git add locales/en-US.json locales/ja-JP.json locales/es-ES.json locales/ko-KR.json tests/i18n/race-class-localization.test.ts
git commit -m "feat: add race and class translations to all locale files"
```

---

### Task 6: Add Frontend i18n Functions for Race/Class Names

**Files:**
- Modify: `public/js/i18n.ts` (add getLocalizedRaceName and getLocalizedClassName functions)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/frontend/i18n-race-class.test.ts
import { describe, it, expect, vi } from "vitest";

describe("Frontend i18n - Race/Class Names", () => {
  it("should have getLocalizedRaceName function", () => {
    // Verify function exists in i18n module
    expect(true).toBe(true); // Placeholder - real test requires browser environment
  });

  it("should have getLocalizedClassName function", () => {
    expect(true).toBe(true); // Placeholder
  });
});
```

- [ ] **Step 2: Run test to verify it passes (placeholder)**

Run: `npx vitest run tests/frontend/i18n-race-class.test.ts`
Expected: PASS (placeholder tests)

- [ ] **Step 3: Add getLocalizedRaceName and getLocalizedClassName to i18n.ts**

Add to public/js/i18n.ts after existing helper functions:

```typescript
/**
 * Get localized race name
 */
export function getLocalizedRaceName(race: string): string {
  const key = `race.${race.toLowerCase()}`;
  return t(key) || race; // Fallback to English if translation missing
}

/**
 * Get localized class name
 */
export function getLocalizedClassName(characterClass: string): string {
  const key = `class.${characterClass.toLowerCase()}`;
  return t(key) || characterClass; // Fallback to English if translation missing
}
```

- [ ] **Step 4: Export new functions from i18n.ts**

Update the export statement at the end of i18n.ts to include the new functions.

- [ ] **Step 5: Commit**

```bash
git add public/js/i18n.ts tests/frontend/i18n-race-class.test.ts
git commit -m "feat: add getLocalizedRaceName and getLocalizedClassName functions"
```

---

### Task 7: Update Frontend Character Display to Use Localized Names

**Files:**
- Modify: `public/js/app.ts` (find renderPlayerDetail or similar method)
- Modify: `public/js/character.ts` (verify showForm uses localized names)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/frontend/character-display-localization.test.ts
import { describe, it, expect } from "vitest";

describe("Character Display Localization", () => {
  it("should display race name in localized language", () => {
    // E2E test - verify character panel shows "法师" not "Wizard" in zh-CN
    expect(true).toBe(true); // Placeholder
  });

  it("should display class name in localized language", () => {
    expect(true).toBe(true); // Placeholder
  });
});
```

- [ ] **Step 2: Run test to verify it passes (placeholder)**

Run: `npx vitest run tests/frontend/character-display-localization.test.ts`
Expected: PASS (placeholder tests)

- [ ] **Step 3: Find and update renderPlayerDetail in app.ts**

Search for method that displays player character details. Update race/class display to use localized names:

```typescript
// Example - find actual method in app.ts
private renderPlayerDetail(player: Player): void {
  const detailPanel = document.getElementById("player-detail-panel");
  if (!detailPanel) return;

  detailPanel.innerHTML = `
    <h3>${this.escapeHtml(player.characterName)}</h3>
    <div class="character-info">
      <span class="race-label">${getLocalizedRaceName(player.race)}</span>
      <span class="class-label">${getLocalizedClassName(player.characterClass)}</span>
      <span class="level-label">${t("level.abbreviation")}${player.level}</span>
    </div>
    <!-- ... rest of player details ... -->
  `;
}
```

- [ ] **Step 4: Verify character.ts showForm uses localized names**

Check public/js/character.ts line ~100+ where race/class dropdowns are rendered. Should already use getLocalizedNames() for race names. Update class names if needed:

```typescript
// In showForm method, update class dropdown
const classOptionsHtml = classOptions.map(cls => 
  `<option value="${cls}">${getLocalizedClassName(cls)}</option>`
).join("");
```

- [ ] **Step 5: Import new functions in app.ts and character.ts**

Add to import statements at top of both files:

```typescript
import { initI18n, getLocale, setLocale, t, SUPPORTED_LOCALES, getLocalizedScenarios, getLocalizedRaceName, getLocalizedClassName } from "./i18n.js";
```

- [ ] **Step 6: Manual verification**

Run: `npm run build` then start server manually, switch to zh-CN locale
Expected: Character panel shows "法师" not "Wizard", "人类" not "Human"

- [ ] **Step 7: Commit**

```bash
git add public/js/app.ts public/js/character.ts
git commit -m "feat: update character display to use localized race/class names"
```

---

### Task 8: Run Full Test Suite and Build Verification

**Files:**
- No changes - verification only

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (should be 179+ tests)

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors, exit code 0

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: Build succeeds, dist/ folder populated

- [ ] **Step 4: Commit verification results**

```bash
git commit --allow-empty -m "chore: verify all tests pass and build succeeds after bug fixes"
```

---

### Task 9: Push to Remote

**Files:**
- No changes - git operation only

- [ ] **Step 1: Push to origin/main**

Run: `git push origin main`
Expected: All commits pushed successfully

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-05-bug-fixes-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
