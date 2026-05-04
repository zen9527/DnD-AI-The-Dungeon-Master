# File-Based Game Persistence with Auto-Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create file-based storage system for saving/loading games to JSON files with auto-save every 60 seconds.

**Architecture:** 
- New `src/utils/storage.ts` module handles all file I/O operations
- `GameStore` integrates storage methods for save/load/auto-save
- Games stored in `saved_games/` directory as individual JSON files
- Auto-save runs on a 60-second interval per game

**Tech Stack:** Node.js fs module, TypeScript, Vitest for testing

---

## File Structure

**Create:**
- `src/utils/storage.ts` - File storage utilities (saveGame, loadGame, listGames, deleteGame, setupAutoSave)
- `tests/game/storage.test.ts` - Test suite for storage functions

**Modify:**
- `src/game/store.ts:1-104` - Add saveAllGames(), loadSavedGames(), startAutoSave() methods
- `locales/en-US.json:189` - Add save/load locale strings at end
- `locales/zh-CN.json:512` - Add save/load locale strings at end

---

### Task 1: Write Failing Tests for Storage Functions

**Files:**
- Create: `tests/game/storage.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { saveGame, loadGame, listGames, deleteGame } from "../../src/utils/storage.js";

describe("saveGame", () => {
  it("should save game to JSON file", () => {
    const mockGame = {
      id: "test-game-123",
      name: "Test Adventure",
      players: [],
      npcs: [],
      chatHistory: [],
      events: [],
      conversationHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Mock fs.writeFileSync
    const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    const result = saveGame(mockGame as any);
    
    expect(result).toBe("test-game-123");
    expect(writeSpy).toHaveBeenCalled();
    const calledPath = writeSpy.mock.calls[0][0] as string;
    expect(calledPath).toContain("test-game-123.json");

    writeSpy.mockRestore();
  });
});

describe("loadGame", () => {
  it("should load game from JSON file", () => {
    const mockGame = { 
      id: "test-game", 
      name: "Test", 
      players: [], 
      npcs: [], 
      chatHistory: [], 
      events: [],
      conversationHistory: [],
      createdAt: Date.now(), 
      updatedAt: Date.now() 
    };
    
    const readSpy = vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(mockGame));
    const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);

    const result = loadGame("test-game");
    
    expect(result).toEqual(mockGame);

    readSpy.mockRestore();
    existsSpy.mockRestore();
  });

  it("should return null for non-existent game", () => {
    const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);

    const result = loadGame("non-existent");
    
    expect(result).toBeNull();

    existsSpy.mockRestore();
  });
});

describe("listGames", () => {
  it("should return list of saved games", () => {
    const readdirSpy = vi.spyOn(fs, "readdirSync").mockReturnValue(["game1.json", "game2.json"]);
    const readSpy = vi.spyOn(fs, "readFileSync").mockImplementation((filePath: any) => {
      const name = filePath.includes("game1") ? "Game One" : "Game Two";
      return JSON.stringify({ 
        id: name.toLowerCase().replace(" ", "-"), 
        name, 
        players: [], 
        npcs: [], 
        chatHistory: [], 
        events: [],
        conversationHistory: [],
        createdAt: Date.now(), 
        updatedAt: Date.now() 
      });
    });

    const result = listGames();
    
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("Game One");
    expect(result[1].name).toBe("Game Two");

    readdirSpy.mockRestore();
    readSpy.mockRestore();
  });
});

describe("deleteGame", () => {
  it("should delete game file", () => {
    const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);
    const unlinkSpy = vi.spyOn(fs, "unlinkSync").mockImplementation(() => {});

    const result = deleteGame("test-game");
    
    expect(result).toBe(true);
    expect(unlinkSpy).toHaveBeenCalled();

    existsSpy.mockRestore();
    unlinkSpy.mockRestore();
  });

  it("should return false for non-existent game", () => {
    const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);

    const result = deleteGame("non-existent");
    
    expect(result).toBe(false);

    existsSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/storage.test.ts`
Expected: FAIL - Cannot find module '../../src/utils/storage.js' (file not found)

---

### Task 2: Implement Storage Utility Module

**Files:**
- Create: `src/utils/storage.ts`

- [ ] **Step 1: Write minimal implementation**

```typescript
import * as fs from "fs";
import * as path from "path";
import type { Game } from "../types/index.js";

const STORAGE_DIR = path.join(process.cwd(), "saved_games");

function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

export function saveGame(game: Game): string {
  ensureStorageDir();
  
  const filePath = path.join(STORAGE_DIR, `${game.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(game, null, 2));
  
  console.log(`[Storage] Saved game ${game.id} to ${filePath}`);
  return game.id;
}

export function loadGame(gameId: string): Game | null {
  ensureStorageDir();
  
  const filePath = path.join(STORAGE_DIR, `${gameId}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`[Storage] Game ${gameId} not found`);
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const game = JSON.parse(content) as Game;
    console.log(`[Storage] Loaded game ${gameId}`);
    return game;
  } catch (error) {
    console.error(`[Storage] Failed to load game ${gameId}:`, error);
    return null;
  }
}

export function listGames(): Array<{ id: string; name: string; createdAt: number }> {
  ensureStorageDir();
  
  const files = fs.readdirSync(STORAGE_DIR).filter(f => f.endsWith(".json"));
  
  return files.map(file => {
    const gameId = file.replace(".json", "");
    const filePath = path.join(STORAGE_DIR, file);
    
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const game = JSON.parse(content) as Game;
      return { id: game.id, name: game.name, createdAt: game.createdAt };
    } catch {
      return null;
    }
  }).filter((g): g is NonNullable<typeof g> => g !== null);
}

export function deleteGame(gameId: string): boolean {
  ensureStorageDir();
  
  const filePath = path.join(STORAGE_DIR, `${gameId}.json`);
  
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  fs.unlinkSync(filePath);
  console.log(`[Storage] Deleted game ${gameId}`);
  return true;
}

export function setupAutoSave(game: Game, intervalMs: number = 60000): NodeJS.Timeout {
  return setInterval(() => {
    saveGame(game);
  }, intervalMs);
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/game/storage.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

---

### Task 3: Add Save/Load Methods to GameStore

**Files:**
- Modify: `src/game/store.ts:100-104` (add methods before closing class)

- [ ] **Step 1: Add storage import and methods**

Add after line 2 (after existing imports):
```typescript
import * as storage from "../utils/storage.js";
```

Add before line 102 (before `export const gameStore = new GameStore();`):
```typescript
  saveAllGames(): void {
    for (const [id, engine] of this.games.entries()) {
      storage.saveGame(engine.game);
    }
  }

  loadSavedGames(): void {
    const saved = storage.listGames();
    for (const gameMeta of saved) {
      const gameData = storage.loadGame(gameMeta.id);
      if (gameData) {
        // Recreate engine from saved game
        const config = configManager.read();
        const engine = new GameEngine(
          gameData,
          config.llmBaseUrl,
          config.llmApiKey,
          config.llmModel
        );
        this.games.set(gameMeta.id, engine);
      }
    }
  }

  startAutoSave(): void {
    setInterval(() => this.saveAllGames(), 60000);
  }
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

---

### Task 4: Add Locale Strings for Save/Load Messages

**Files:**
- Modify: `locales/en-US.json:189` (add at end before closing brace)
- Modify: `locales/zh-CN.json:512` (add at end before closing brace)

- [ ] **Step 1: Add English locale strings**

Add after line 188 (after `"private_chat.received": "Private message from {senderName}"`):
```json
,
  "save.success": "✅ Game saved!",
  "save.error": "❌ Save failed",
  "load.success": "✅ Game loaded!",
  "load.error": "❌ Failed to load game",
  "saved_games.title": "💾 Saved Adventures"
```

- [ ] **Step 2: Add Chinese locale strings**

Add after line 511 (after `"private_chat.received": "收到来自 {senderName} 的私聊"`):
```json
,
  "save.success": "✅ 游戏已保存！",
  "save.error": "❌ 保存失败",
  "load.success": "✅ 游戏已加载！",
  "load.error": "❌ 加载游戏失败",
  "saved_games.title": "💾 已保存的冒险"
```

- [ ] **Step 3: Verify JSON syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('locales/en-US.json', 'utf-8'))"`
Run: `node -e "JSON.parse(require('fs').readFileSync('locales/zh-CN.json', 'utf-8'))"`
Expected: No errors (valid JSON)

---

### Task 5: Run Full Test Suite and Commit

**Files:**
- All created/modified files

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass including new storage tests

- [ ] **Step 2: Final TypeScript verification**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit changes**

```bash
git add src/utils/storage.ts src/game/store.ts locales/en-US.json locales/zh-CN.json tests/game/storage.test.ts
git commit -m "feat: add file-based game persistence with auto-save"
```

- [ ] **Step 4: Push to origin/main**

```bash
git push origin main
```

---

## Self-Review Checklist

After completing all tasks, verify:

1. **Spec coverage:** All requirements met?
   - ✅ `src/utils/storage.ts` created with saveGame, loadGame, listGames, deleteGame, setupAutoSave
   - ✅ `tests/game/storage.test.ts` created with 5 test cases
   - ✅ `src/game/store.ts` modified with saveAllGames, loadSavedGames, startAutoSave
   - ✅ Locale strings added to both en-US.json and zh-CN.json
   - ✅ Storage directory: `saved_games/` in project root

2. **Placeholder scan:** No "TBD", "TODO", or vague instructions?

3. **Type consistency:** All types match Game interface from `src/types/index.ts`?

---

## Execution Handoff

**Plan complete and saved.** Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
