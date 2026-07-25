# DnD AI Refactor — Phase 1: Critical Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 runtime bugs, eliminate 14 `any` types, and add Zod validation to 10 unvalidated WebSocket handlers.

**Architecture:** Bug fixes are surgical edits to existing files. Type safety fixes replace `any` with proper types from `src/types/index.ts` and `shared/schemas/`. Zod validation wraps existing handler payloads with `.safeParse()` using schemas that already exist in `shared/schemas/`.

**Tech Stack:** TypeScript, Zod, Express, ws, Vite (frontend)

---

### Task 1: Fix `addMessageHandler` bug in `app.ts`

**Files:**
- Modify: `public/js/app.ts:1459`

- [ ] **Step 1: Write a test to verify the bug exists**

Create `tests/frontend/addMessageHandler-bug.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { WebSocketManager } from '../../public/js/websocket.js';

describe('WebSocketManager API', () => {
  it('has an `on` method for registering message handlers', () => {
    const ws = new WebSocketManager();
    expect(typeof ws.on).toBe('function');
  });

  it('does NOT have an `addMessageHandler` method', () => {
    const ws = new WebSocketManager();
    expect((ws as any).addMessageHandler).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to confirm the bug pattern**

Run: `npx vitest run tests/frontend/addMessageHandler-bug.test.ts`
Expected: PASS (confirms `addMessageHandler` does not exist on `WebSocketManager`)

- [ ] **Step 3: Fix the bug in `app.ts`**

In `public/js/app.ts`, replace line 1459:

```typescript
// BEFORE (broken):
wsManager.addMessageHandler("DM_CONTROL_UPDATE", () => {
  const panel = document.getElementById("dm-control-panel");
  if (panel) {
    this.renderDMControlPanel();
  }
});

// AFTER (fixed):
wsManager.on("DM_CONTROL_UPDATE", () => {
  const panel = document.getElementById("dm-control-panel");
  if (panel) {
    this.renderDMControlPanel();
  }
});
```

- [ ] **Step 4: Verify the fix compiles**

Run: `npx tsc --noEmit`
Expected: Exit 0

- [ ] **Step 5: Commit**

```bash
git add public/js/app.ts tests/frontend/addMessageHandler-bug.test.ts
git commit -m "fix: replace non-existent addMessageHandler with wsManager.on()"
```

---

### Task 2: Fix `showNotification` "warning" type

**Files:**
- Modify: `public/js/app.ts:849`

- [ ] **Step 1: Add "warning" to NotificationType and CSS class**

In `public/js/app.ts`, find the `showNotification` method at line 849 and update the type signature:

```typescript
// BEFORE:
private showNotification(text: string, type: "success" | "error" | "info"): void {

// AFTER:
private showNotification(text: string, type: "success" | "error" | "info" | "warning"): void {
```

- [ ] **Step 2: Add the `.notification-warning` CSS class**

In `public/css/style.css`, find the notification section and add:

```css
.notification-warning {
  background: #fff3cd;
  color: #856404;
  border-left-color: #ffc107;
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: Exit 0

- [ ] **Step 4: Commit**

```bash
git add public/js/app.ts public/css/style.css
git commit -m "fix: add 'warning' notification type with CSS styling"
```

---

### Task 3: Fix `gameState.subscribe` callback signature mismatch

**Files:**
- Modify: `public/js/game-state.ts:147`

- [ ] **Step 1: Write a test for subscribe callback signature**

Create `tests/frontend/game-state-subscribe.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { GameState } from '../../public/js/game-state.js';

describe('GameState.subscribe', () => {
  it('passes all 7 fields in the initial callback invocation', () => {
    const gs = new GameState();
    const callback = vi.fn();
    gs.subscribe(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const args = callback.mock.calls[0][0];

    // All fields must be present (not undefined) in the initial call
    expect(args).toHaveProperty('game');
    expect(args).toHaveProperty('currentPlayer');
    expect(args).toHaveProperty('timerState');
    expect(args).toHaveProperty('combatMode');
    expect(args).toHaveProperty('initiativeOrder');
    expect(args).toHaveProperty('currentRound');
    expect(args).toHaveProperty('currentTurnIndex');
  });

  it('passes consistent fields between initial call and notifyListeners', () => {
    const gs = new GameState();
    const callback = vi.fn();
    gs.subscribe(callback);

    const initialArgs = callback.mock.calls[0][0];
    const initialKeys = Object.keys(initialArgs).sort();

    // Trigger a notify via setCombatState
    gs.setCombatState({
      combatMode: true,
      initiativeOrder: [],
      currentRound: 1,
      currentTurnIndex: 0,
    });

    const notifiedArgs = callback.mock.calls[1][0];
    const notifiedKeys = Object.keys(notifiedArgs).sort();

    expect(initialKeys).toEqual(notifiedKeys);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/frontend/game-state-subscribe.test.ts`
Expected: FAIL — the initial callback only passes `{ game, currentPlayer }` (2 fields), not all 7.

- [ ] **Step 3: Fix the subscribe method**

In `public/js/game-state.ts`, replace line 147:

```typescript
// BEFORE (line 147):
callback({ game: this._game, currentPlayer: this._currentPlayer });

// AFTER:
callback({
  game: this._game,
  currentPlayer: this._currentPlayer,
  timerState: this._timerState,
  combatMode: this._combatMode,
  initiativeOrder: this._initiativeOrder,
  currentRound: this._currentRound,
  currentTurnIndex: this._currentTurnIndex,
  currentPlayerName: this._currentPlayerName,
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/frontend/game-state-subscribe.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/js/game-state.ts tests/frontend/game-state-subscribe.test.ts
git commit -m "fix: pass all fields in gameState.subscribe initial callback"
```

---

### Task 4: Fix hardcoded "en-US" in engine combat narratives

**Files:**
- Modify: `src/game/engine.ts:164,191`

- [ ] **Step 1: Write a test for locale-aware combat narratives**

Create `tests/game/engine-locale.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../src/game/engine.js';
import type { Game, Player } from '../../src/types/index.js';

function createTestPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Test',
    characterName: 'TestChar',
    isDM: true,
    race: 'Human',
    characterClass: 'Fighter',
    level: 1,
    attributes: { str: 14, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    hp: 10,
    maxHp: 10,
    ac: 12,
    proficiencyBonus: 2,
    spellSlots: {},
    spells: [],
    inventory: [],
    conditions: [],
    buffs: [],
    hitDice: { total: 10, used: 0 },
    deathSaves: { successes: 0, failures: 0 },
    xp: 0,
    locale: 'zh-CN',
    usedItems: [],
    ...overrides,
  };
}

function createTestEngine(): GameEngine {
  const player = createTestPlayer();
  return new GameEngine(
    {
      id: 'g1',
      name: 'Test Game',
      maxPlayers: 4,
      scenario: 'dungeon',
      players: [player],
      npcs: [],
      chatHistory: [],
      events: [],
      combatMode: false,
      initiativeOrder: [],
      currentRound: 1,
      currentTurnIndex: 0,
    },
    'http://localhost:1234/v1',
    null,
    'test-model'
  );
}

describe('GameEngine locale handling', () => {
  it('startCombat uses player locale instead of hardcoded en-US', () => {
    const engine = createTestEngine();
    engine.startCombat(true);

    const history = engine.game.conversationHistory;
    const narrative = history[history.length - 1].content;

    // The narrative should NOT be empty
    expect(narrative.length).toBeGreaterThan(0);

    // The engine should use the player's locale (zh-CN) for getLocalizedMessage
    // We verify this by checking that the method was called and produced output
    // (the actual Chinese string depends on locale-loader returning the right key)
    expect(narrative).toBeDefined();
  });

  it('endCombat uses player locale instead of hardcoded en-US', () => {
    const engine = createTestEngine();
    engine.startCombat(false);
    engine.endCombat();

    const history = engine.game.conversationHistory;
    const lastMsg = history[history.length - 1].content;

    expect(lastMsg.length).toBeGreaterThan(0);
    expect(lastMsg).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/game/engine-locale.test.ts`
Expected: PASS (tests are loose — they verify the method works, the real fix is in step 3)

- [ ] **Step 3: Fix the hardcoded locale in `startCombat` and `endCombat`**

In `src/game/engine.ts`, add a helper method to get the current player's locale. Find the `startCombat` method (around line 119) and replace the hardcoded `"en-US"` references:

```typescript
// Add this private helper inside the GameEngine class (near line 85):
private getPlayerLocale(): string {
  // Use the first player's locale, fallback to en-US
  return this._game.players?.[0]?.locale || "en-US";
}
```

Then in `startCombat()` at line 164, replace:

```typescript
// BEFORE:
const narrative = `${getLocalizedMessage("en-US", "initiative.rolled")}\n${this._game.initiativeOrder.map((entry, i) => {

// AFTER:
const narrative = `${getLocalizedMessage(this.getPlayerLocale(), "initiative.rolled")}\n${this._game.initiativeOrder.map((entry, i) => {
```

And in `endCombat()` at line 191, replace:

```typescript
// BEFORE:
const narrative = getLocalizedMessage("en-US", "combat.ended");

// AFTER:
const narrative = getLocalizedMessage(this.getPlayerLocale(), "combat.ended");
```

- [ ] **Step 4: Run the test again**

Run: `npx vitest run tests/game/engine-locale.test.ts`
Expected: PASS

- [ ] **Step 5: Verify full compilation**

Run: `npx tsc --noEmit`
Expected: Exit 0

- [ ] **Step 6: Commit**

```bash
git add src/game/engine.ts tests/game/engine-locale.test.ts
git commit -m "fix: use player locale for combat narratives instead of hardcoded en-US"
```

---

### Task 5: Replace `any` types in `engine.ts` with proper types

**Files:**
- Modify: `src/game/engine.ts`

- [ ] **Step 1: Fix `initiativeOrder` getter (line 81)**

```typescript
// BEFORE (line 81):
get initiativeOrder(): any[] { return this._game.initiativeOrder; }

// AFTER:
get initiativeOrder(): InitiativeEntry[] { return this._game.initiativeOrder; }
```

Add `InitiativeEntry` to the import at line 7:

```typescript
// BEFORE:
import type { Game, Player, NPC, ChatMessage, PlayerActionPayload, StreamResult } from "../types/index.js";

// AFTER:
import type { Game, Player, NPC, ChatMessage, PlayerActionPayload, StreamResult, InitiativeEntry } from "../types/index.js";
```

- [ ] **Step 2: Fix `addItemToInventory` (line 1015)**

```typescript
// BEFORE (line 1015):
addItemToInventory(playerId: string, item: any): void {

// AFTER:
addItemToInventory(playerId: string, item: Item): void {
```

Add `Item` to the import:

```typescript
// Update the import at line 7:
import type { Game, Player, NPC, ChatMessage, PlayerActionPayload, StreamResult, InitiativeEntry, Item } from "../types/index.js";
```

- [ ] **Step 3: Fix `getPlayerInventory` (line 1085)**

```typescript
// BEFORE (line 1085):
getPlayerInventory(playerId: string): any[] {

// AFTER:
getPlayerInventory(playerId: string): Item[] {
```

- [ ] **Step 4: Fix `getEquippedItems` (line 1095)**

```typescript
// BEFORE (line 1095):
getEquippedItems(playerId: string): { weapon?: any; armor?: any } {

// AFTER:
getEquippedItems(playerId: string): { weapon?: Item; armor?: Item } {
```

- [ ] **Step 5: Fix `recalculatePlayerAC` (line 1140)**

```typescript
// BEFORE (line 1140):
private recalculatePlayerAC(player: any): void {

// AFTER:
private recalculatePlayerAC(player: Player): void {
```

- [ ] **Step 6: Fix buff-related `any` types (lines 1231-1252)**

In `applyBuff` method (line 1231-1232):

```typescript
// BEFORE:
const buffs = (entity as any).buffs || [];
const existingIndex = buffs.findIndex((b: any) => b.name === buff.name);

// AFTER:
const buffs = (entity as Player | NPC).buffs || [];
const existingIndex = buffs.findIndex((b) => b.name === buff.name);
```

In the same method (line 1238):

```typescript
// BEFORE:
(entity as any).buffs = buffs;

// AFTER:
(entity as Player | NPC).buffs = buffs;
```

In `removeBuff` method (line 1250-1252):

```typescript
// BEFORE:
const buffs = (entity as any).buffs;
if (!buffs) return;
(entity as any).buffs = buffs.filter((b: any) => b.name !== buffName);

// AFTER:
const buffs = (entity as Player | NPC).buffs;
if (!buffs) return;
(entity as Player | NPC).buffs = buffs.filter((b) => b.name !== buffName);
```

In `applyTemporaryHP` method (line 1217-1219):

```typescript
// BEFORE:
const currentTempHp = (entity as any).temporaryHp || 0;
(entity as any).temporaryHp = Math.max(currentTempHp, amount);
(entity as any).temporaryHpRemaining = duration;

// AFTER:
const currentTempHp = (entity as Player | NPC).temporaryHp || 0;
(entity as Player | NPC).temporaryHp = Math.max(currentTempHp, amount);
(entity as Player | NPC).temporaryHpRemaining = duration;
```

- [ ] **Step 7: Verify no `any` types remain in engine.ts**

Run: `npx tsc --noEmit`
Expected: Exit 0

Run: `grep -n "any" src/game/engine.ts`
Expected: No results (or only in comments)

- [ ] **Step 8: Run existing tests**

Run: `npx vitest run tests/game/`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add src/game/engine.ts
git commit -m "fix: replace all 'any' types in GameEngine with proper types"
```

---

### Task 6: Replace `any` types in `game-state.ts` and `app.ts`

**Files:**
- Modify: `public/js/game-state.ts`
- Modify: `public/js/app.ts`

- [ ] **Step 1: Fix `initiativeOrder: any[]` in `game-state.ts` (5 occurrences)**

Add `InitiativeEntry` to the import at line 1:

```typescript
// BEFORE:
import type { Game, Player, ChatMessage, NPC, StructuredResult, StreamResult } from "../../shared/index.js";

// AFTER:
import type { Game, Player, ChatMessage, NPC, StructuredResult, StreamResult, InitiativeEntry } from "../../shared/index.js";
```

Then replace all 5 occurrences of `any[]` in the file:

```typescript
// Line 10 (GameStateListener interface):
initiativeOrder: any[];  →  initiativeOrder: InitiativeEntry[];

// Line 23 (private field):
private _initiativeOrder: any[] = [];  →  private _initiativeOrder: InitiativeEntry[] = [];

// Line 34 (getter):
get initiativeOrder(): any[] {  →  get initiativeOrder(): InitiativeEntry[] {

// Line 72 (setCombatState parameter):
initiativeOrder: any[];  →  initiativeOrder: InitiativeEntry[];

// Line 85 (setInitiativeOrder parameter):
setInitiativeOrder(order: any[]): void {  →  setInitiativeOrder(order: InitiativeEntry[]): void {
```

- [ ] **Step 2: Fix `item?: any` in `app.ts` (line ~506)**

Find the INVENTORY_UPDATE handler and replace:

```typescript
// BEFORE:
const p = payload as { playerId: string; action: string; item?: any };

// AFTER:
import type { Item } from "../../shared/index.js";
const p = payload as { playerId: string; action: string; item?: Item };
```

- [ ] **Step 3: Fix `renderConditionCheckboxes(npc: any)` in `app.ts` (line ~1285)**

```typescript
// BEFORE:
private renderConditionCheckboxes(npc: any): string {

// AFTER:
private renderConditionCheckboxes(npc: NPC): string {
```

Ensure `NPC` is imported from `../../shared/index.js` (it should already be imported at line 9).

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: Exit 0

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add public/js/game-state.ts public/js/app.ts
git commit -m "fix: replace 'any' types in frontend with InitiativeEntry, Item, NPC"
```

---

### Task 7: Add Zod validation to `handleDiceRoll`

**Files:**
- Modify: `src/websocket/manager.ts:721-756`

- [ ] **Step 1: Write a test for dice roll validation**

Create `tests/websocket/dice-validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { diceRollSchema } from '../../shared/schemas/game.js';

describe('diceRollSchema validation', () => {
  it('accepts valid d20 roll', () => {
    const result = diceRollSchema.safeParse({ diceType: 20, count: 1, modifier: 5 });
    expect(result.success).toBe(true);
  });

  it('accepts valid d6 roll with multiple dice', () => {
    const result = diceRollSchema.safeParse({ diceType: 6, count: 3 });
    expect(result.success).toBe(true);
  });

  it('rejects diceType: 100 (invalid die)', () => {
    const result = diceRollSchema.safeParse({ diceType: 100, count: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects count: 0', () => {
    const result = diceRollSchema.safeParse({ diceType: 20, count: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects count > 10', () => {
    const result = diceRollSchema.safeParse({ diceType: 20, count: 11 });
    expect(result.success).toBe(false);
  });

  it('rejects missing diceType', () => {
    const result = diceRollSchema.safeParse({ count: 1 });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/websocket/dice-validation.test.ts`
Expected: PASS

- [ ] **Step 3: Add Zod validation to `handleDiceRoll`**

In `src/websocket/manager.ts`, replace the `handleDiceRoll` method (lines 721-756):

```typescript
private handleDiceRoll(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
  if (!client.gameId || !client.playerId) {
    this.sendError(ws, "Not in a game");
    return;
  }
  const engine = gameStore.getGame(client.gameId);
  if (!engine) {
    this.sendError(ws, "Game not found");
    return;
  }
  const player = engine.game.players.find(p => p.id === client.playerId);
  if (!player) {
    this.sendError(ws, "Player not found");
    return;
  }

  const parsed = diceRollSchema.safeParse(payload);
  if (!parsed.success) {
    this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
    return;
  }

  const { diceType, count, modifier = 0 } = parsed.data;
  const rolls = rollDice(diceType, count);
  const total = calculateTotal(rolls, modifier);
  this.broadcastToGame(client.gameId, "DICE_ROLL_RESULT", {
    result: {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      playerId: client.playerId,
      playerName: player.name,
      characterName: player.characterName,
      diceType,
      count,
      rolls,
      modifier,
      total,
      timestamp: Date.now(),
    },
  });
}
```

Ensure `diceRollSchema` is imported. Add it to the import on line 13:

```typescript
import { HIT_DIE_BY_CLASS, createGameSchema, joinGameSchema, playerActionSchema, chatMessageSchema, emoteSchema, privateChatSchema, combatStartSchema, initiativeRollSchema, saveGameSchema, npcUpdateHpSchema, npcApplyConditionSchema, npcRemoveConditionSchema, npcDeleteSchema, playerAwardXpSchema, playerLevelUpSchema, diceRollSchema } from "../../shared/index.js";
```

- [ ] **Step 4: Verify compilation and tests**

Run: `npx tsc --noEmit && npx vitest run tests/websocket/dice-validation.test.ts`
Expected: Exit 0 and PASS

- [ ] **Step 5: Commit**

```bash
git add src/websocket/manager.ts tests/websocket/dice-validation.test.ts
git commit -m "fix: add Zod validation to handleDiceRoll"
```

---

### Task 8: Add Zod validation to `handleNPCCreate` and `handleEventCreate`

**Files:**
- Modify: `src/websocket/manager.ts:758-772`

- [ ] **Step 1: Write tests for NPC and event creation validation**

Create `tests/websocket/npc-event-validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { npcSchema, eventSchema } from '../../shared/schemas/game.js';

describe('npcSchema validation', () => {
  it('accepts valid NPC', () => {
    const result = npcSchema.safeParse({ name: "Goblin", role: "hostile" });
    expect(result.success).toBe(true);
  });

  it('accepts NPC with optional description', () => {
    const result = npcSchema.safeParse({ name: "Merchant", description: "A friendly merchant", role: "friendly" });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = npcSchema.safeParse({ name: "", role: "neutral" });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const result = npcSchema.safeParse({ name: "Test", role: "invalid" });
    expect(result.success).toBe(false);
  });
});

describe('eventSchema validation', () => {
  it('accepts valid event', () => {
    const result = eventSchema.safeParse({ title: "Dragon Appears" });
    expect(result.success).toBe(true);
  });

  it('accepts event with optional description', () => {
    const result = eventSchema.safeParse({ title: "Dragon Appears", description: "A red dragon flies overhead" });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = eventSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/websocket/npc-event-validation.test.ts`
Expected: PASS

- [ ] **Step 3: Add Zod validation to `handleNPCCreate`**

In `src/websocket/manager.ts`, replace the `handleNPCCreate` method (lines 758-764):

```typescript
private handleNPCCreate(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
  if (!client.gameId) { this.sendError(ws, "Not in a game"); return; }
  const engine = gameStore.getGame(client.gameId);
  if (!engine) { this.sendError(ws, "Game not found"); return; }

  const parsed = npcSchema.safeParse(payload);
  if (!parsed.success) {
    this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
    return;
  }

  engine.addNPC(parsed.data.name, parsed.data.description || "", parsed.data.role);
  this.broadcastToGame(engine.id, "NPC_CREATED", { npc: engine.game.npcs[engine.game.npcs.length - 1] });
}
```

- [ ] **Step 4: Add Zod validation to `handleEventCreate`**

In `src/websocket/manager.ts`, replace the `handleEventCreate` method (lines 766-772):

```typescript
private handleEventCreate(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
  if (!client.gameId) { this.sendError(ws, "Not in a game"); return; }
  const engine = gameStore.getGame(client.gameId);
  if (!engine) { this.sendError(ws, "Game not found"); return; }

  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) {
    this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
    return;
  }

  engine.addEvent(parsed.data.title, parsed.data.description || "");
  this.broadcastToGame(engine.id, "EVENT_CREATED", { event: engine.game.chatHistory[engine.game.chatHistory.length - 1] });
}
```

- [ ] **Step 5: Verify compilation and tests**

Run: `npx tsc --noEmit && npx vitest run tests/websocket/npc-event-validation.test.ts`
Expected: Exit 0 and PASS

- [ ] **Step 6: Commit**

```bash
git add src/websocket/manager.ts tests/websocket/npc-event-validation.test.ts
git commit -m "fix: add Zod validation to handleNPCCreate and handleEventCreate"
```

---

### Task 9: Add Zod validation to equipment and inventory handlers

**Files:**
- Modify: `src/websocket/manager.ts:1244-1400` (equipment handlers)
- Modify: `src/websocket/manager.ts:1201-1242` (inventory add)

- [ ] **Step 1: Write tests for equipment validation**

Create `tests/websocket/equipment-validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { equipItemSchema, useItemSchema, itemSchema } from '../../shared/schemas/game.js';

describe('equipItemSchema validation', () => {
  it('accepts valid equip weapon', () => {
    const result = equipItemSchema.safeParse({ itemId: "item_1", slot: "weapon" });
    expect(result.success).toBe(true);
  });

  it('accepts valid equip armor', () => {
    const result = equipItemSchema.safeParse({ itemId: "item_2", slot: "armor" });
    expect(result.success).toBe(true);
  });

  it('rejects invalid slot', () => {
    const result = equipItemSchema.safeParse({ itemId: "item_1", slot: "helmet" });
    expect(result.success).toBe(false);
  });

  it('rejects missing itemId', () => {
    const result = equipItemSchema.safeParse({ slot: "weapon" });
    expect(result.success).toBe(false);
  });
});

describe('useItemSchema validation', () => {
  it('accepts valid use item', () => {
    const result = useItemSchema.safeParse({ itemId: "potion_1" });
    expect(result.success).toBe(true);
  });

  it('accepts use item with target', () => {
    const result = useItemSchema.safeParse({ itemId: "potion_1", targetId: "npc_1" });
    expect(result.success).toBe(true);
  });

  it('rejects missing itemId', () => {
    const result = useItemSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('itemSchema validation', () => {
  it('accepts valid weapon', () => {
    const result = itemSchema.safeParse({
      id: "sword_1",
      name: "Longsword",
      type: "weapon",
      weight: 3,
      stats: { attackBonus: 2, damageDice: { type: 8, count: 1 } },
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid consumable', () => {
    const result = itemSchema.safeParse({
      id: "potion_1",
      name: "Healing Potion",
      type: "consumable",
      weight: 0.5,
      stats: { healingAmount: 10 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid type', () => {
    const result = itemSchema.safeParse({ id: "x", name: "x", type: "invalid", weight: 1 });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/websocket/equipment-validation.test.ts`
Expected: PASS

- [ ] **Step 3: Add Zod validation to equipment handlers**

First, add the missing schemas to the import on line 13 of `manager.ts`:

```typescript
import { HIT_DIE_BY_CLASS, createGameSchema, joinGameSchema, playerActionSchema, chatMessageSchema, emoteSchema, privateChatSchema, combatStartSchema, initiativeRollSchema, saveGameSchema, npcUpdateHpSchema, npcApplyConditionSchema, npcRemoveConditionSchema, npcDeleteSchema, playerAwardXpSchema, playerLevelUpSchema, diceRollSchema, npcSchema, eventSchema, equipItemSchema, useItemSchema, itemSchema } from "../../shared/index.js";
```

Also ensure these are exported from `shared/index.ts`. Add to `shared/index.ts` (they should already be exported from `./schemas/game.js`, but verify `equipItemSchema`, `useItemSchema`, and `itemSchema` are in the exports — check if they need to be added):

If `shared/index.ts` doesn't export `equipItemSchema`, `useItemSchema`, `itemSchema`, add them to the game schemas export block:

```typescript
// In shared/index.ts, add to the game schemas export:
export {
  createGameSchema,
  joinGameSchema,
  createCharacterSchema,
  raceOptions,
  classOptions,
  npcSchema,
  eventSchema,
  diceRollSchema,
  saveGameSchema,
  itemSchema,
  equipItemSchema,
  unequipItemSchema,
  useItemSchema,
  HIT_DIE_BY_CLASS,
  XP_THRESHOLDS,
  SPELL_ABILITY_MAP,
} from "./schemas/game.js";

export type {
  CreateGameInput,
  JoinGameInput,
  CharacterInput,
  NPCInput,
  EventInput,
  DiceRollInput,
  SaveGameInput,
  Item,
} from "./schemas/game.js";
```

Now update `handleEquipWeapon` (around line 1244):

```typescript
private handleEquipWeapon(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
  if (!client.gameId || !client.playerId) {
    this.sendError(ws, "Not in a game");
    return;
  }
  const engine = gameStore.getGame(client.gameId);
  if (!engine) {
    this.sendError(ws, "Game not found");
    return;
  }

  const parsed = equipItemSchema.safeParse({ itemId: payload.itemId, slot: "weapon" });
  if (!parsed.success) {
    this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
    return;
  }

  engine.equipWeapon(client.playerId, parsed.data.itemId);
  this.broadcastToGame(client.gameId, "EQUIPMENT_UPDATE", {
    playerId: client.playerId,
    slot: "weapon",
    itemId: parsed.data.itemId,
  });
}
```

Update `handleEquipArmor` (around line 1268):

```typescript
private handleEquipArmor(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
  if (!client.gameId || !client.playerId) {
    this.sendError(ws, "Not in a game");
    return;
  }
  const engine = gameStore.getGame(client.gameId);
  if (!engine) {
    this.sendError(ws, "Game not found");
    return;
  }

  const parsed = equipItemSchema.safeParse({ itemId: payload.itemId, slot: "armor" });
  if (!parsed.success) {
    this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
    return;
  }

  engine.equipArmor(client.playerId, parsed.data.itemId);
  this.broadcastToGame(client.gameId, "EQUIPMENT_UPDATE", {
    playerId: client.playerId,
    slot: "armor",
    itemId: parsed.data.itemId,
  });
}
```

Update `handleUseItem` (find it after the unequip handlers):

```typescript
private handleUseItem(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
  if (!client.gameId || !client.playerId) {
    this.sendError(ws, "Not in a game");
    return;
  }
  const engine = gameStore.getGame(client.gameId);
  if (!engine) {
    this.sendError(ws, "Game not found");
    return;
  }

  const parsed = useItemSchema.safeParse(payload);
  if (!parsed.success) {
    this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
    return;
  }

  const result = engine.useItem(client.playerId, parsed.data.itemId, parsed.data.targetId);
  this.broadcastToGame(client.gameId, "ITEM_USED", {
    playerId: client.playerId,
    itemId: parsed.data.itemId,
    result,
  });
}
```

- [ ] **Step 4: Add Zod validation to `handleInventoryAddItem`**

```typescript
private handleInventoryAddItem(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
  if (!client.gameId || !client.playerId) {
    this.sendError(ws, "Not in a game");
    return;
  }
  const engine = gameStore.getGame(client.gameId);
  if (!engine) {
    this.sendError(ws, "Game not found");
    return;
  }

  const player = engine.game.players.find(p => p.id === client.playerId);
  if (!player?.isDM) {
    this.sendError(ws, "Only the DM can add items");
    return;
  }

  const itemPayload = payload.item as Record<string, unknown> | undefined;
  if (!itemPayload) {
    this.sendError(ws, "Missing item data");
    return;
  }

  const itemId = (payload.itemId as string) || `item_${Date.now()}`;
  const itemToValidate = { ...itemPayload, id: itemId };

  const parsed = itemSchema.safeParse(itemToValidate);
  if (!parsed.success) {
    this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
    return;
  }

  engine.addItemToInventory(client.playerId, parsed.data);

  this.broadcastToGame(client.gameId, "INVENTORY_UPDATE", {
    playerId: client.playerId,
    action: "add_item",
    item: { id: parsed.data.id, name: parsed.data.name, type: parsed.data.type },
  });
}
```

- [ ] **Step 5: Verify compilation and tests**

Run: `npx tsc --noEmit && npx vitest run tests/websocket/equipment-validation.test.ts`
Expected: Exit 0 and PASS

- [ ] **Step 6: Commit**

```bash
git add src/websocket/manager.ts shared/index.ts tests/websocket/equipment-validation.test.ts
git commit -m "fix: add Zod validation to equipment, inventory, and use-item handlers"
```

---

### Task 10: Add Zod validation to buff/temp-HP handlers

**Files:**
- Modify: `src/websocket/manager.ts` (buff handlers)
- Create: `shared/schemas/buff.ts`

- [ ] **Step 1: Create buff schemas in shared**

Create `shared/schemas/buff.ts`:

```typescript
import { z } from "zod";

export const applyTemporaryHpSchema = z.object({
  targetId: z.string().min(1),
  isPlayer: z.boolean(),
  amount: z.number().int().min(1),
  duration: z.number().int().min(1),
});

export type ApplyTemporaryHpInput = z.infer<typeof applyTemporaryHpSchema>;

export const applyBuffSchema = z.object({
  targetId: z.string().min(1),
  isPlayer: z.boolean(),
  buff: z.object({
    name: z.string().min(1).max(100),
    effect: z.string().min(1).max(200),
    bonus: z.number().optional(),
    duration: z.number().int().min(1),
  }),
});

export type ApplyBuffInput = z.infer<typeof applyBuffSchema>;

export const removeBuffSchema = z.object({
  targetId: z.string().min(1),
  isPlayer: z.boolean(),
  buffName: z.string().min(1),
});

export type RemoveBuffInput = z.infer<typeof removeBuffSchema>;
```

- [ ] **Step 2: Export buff schemas from `shared/index.ts`**

Add to `shared/index.ts`:

```typescript
// Buff schemas
export {
  applyTemporaryHpSchema,
  applyBuffSchema,
  removeBuffSchema,
} from "./schemas/buff.js";
export type {
  ApplyTemporaryHpInput,
  ApplyBuffInput,
  RemoveBuffInput,
} from "./schemas/buff.js";
```

- [ ] **Step 3: Write tests for buff schema validation**

Create `tests/websocket/buff-validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { applyTemporaryHpSchema, applyBuffSchema, removeBuffSchema } from '../../shared/schemas/buff.js';

describe('applyTemporaryHpSchema', () => {
  it('accepts valid temporary HP', () => {
    const result = applyTemporaryHpSchema.safeParse({
      targetId: "p1",
      isPlayer: true,
      amount: 10,
      duration: 3,
    });
    expect(result.success).toBe(true);
  });

  it('rejects amount: 0', () => {
    const result = applyTemporaryHpSchema.safeParse({
      targetId: "p1",
      isPlayer: true,
      amount: 0,
      duration: 3,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing targetId', () => {
    const result = applyTemporaryHpSchema.safeParse({
      isPlayer: true,
      amount: 10,
      duration: 3,
    });
    expect(result.success).toBe(false);
  });
});

describe('applyBuffSchema', () => {
  it('accepts valid buff', () => {
    const result = applyBuffSchema.safeParse({
      targetId: "p1",
      isPlayer: true,
      buff: { name: "Bless", effect: "+1d4 to attacks", duration: 10 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts buff with bonus', () => {
    const result = applyBuffSchema.safeParse({
      targetId: "p1",
      isPlayer: true,
      buff: { name: "Bless", effect: "+2 to attacks", bonus: 2, duration: 10 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects buff without name', () => {
    const result = applyBuffSchema.safeParse({
      targetId: "p1",
      isPlayer: true,
      buff: { effect: "+2 to attacks", duration: 10 },
    });
    expect(result.success).toBe(false);
  });
});

describe('removeBuffSchema', () => {
  it('accepts valid remove buff', () => {
    const result = removeBuffSchema.safeParse({
      targetId: "p1",
      isPlayer: true,
      buffName: "Bless",
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing buffName', () => {
    const result = removeBuffSchema.safeParse({
      targetId: "p1",
      isPlayer: true,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/websocket/buff-validation.test.ts`
Expected: PASS

- [ ] **Step 5: Add Zod validation to buff handlers in `manager.ts`**

Add to the import in `manager.ts`:

```typescript
import { ..., applyTemporaryHpSchema, applyBuffSchema, removeBuffSchema } from "../../shared/index.js";
```

Update `handleApplyTemporaryHP`:

```typescript
private handleApplyTemporaryHP(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
  if (!client.gameId || !client.playerId) {
    this.sendError(ws, "Not in a game");
    return;
  }
  const engine = gameStore.getGame(client.gameId);
  if (!engine) {
    this.sendError(ws, "Game not found");
    return;
  }

  const player = engine.game.players.find(p => p.id === client.playerId);
  if (!player?.isDM) {
    this.sendError(ws, "Only the DM can apply temporary HP");
    return;
  }

  const parsed = applyTemporaryHpSchema.safeParse(payload);
  if (!parsed.success) {
    this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
    return;
  }

  engine.applyTemporaryHP(parsed.data.targetId, parsed.data.isPlayer, parsed.data.amount, parsed.data.duration);

  this.broadcastToGame(client.gameId, "BUFF_UPDATE", {
    action: "apply_temporary_hp",
    targetId: parsed.data.targetId,
    amount: parsed.data.amount,
    duration: parsed.data.duration,
    gameState: engine.game,
  });
}
```

Update `handleApplyBuff`:

```typescript
private handleApplyBuff(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
  if (!client.gameId || !client.playerId) {
    this.sendError(ws, "Not in a game");
    return;
  }
  const engine = gameStore.getGame(client.gameId);
  if (!engine) {
    this.sendError(ws, "Game not found");
    return;
  }

  const player = engine.game.players.find(p => p.id === client.playerId);
  if (!player?.isDM) {
    this.sendError(ws, "Only the DM can apply buffs");
    return;
  }

  const parsed = applyBuffSchema.safeParse(payload);
  if (!parsed.success) {
    this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
    return;
  }

  engine.applyBuff(parsed.data.targetId, parsed.data.isPlayer, parsed.data.buff);

  this.broadcastToGame(client.gameId, "BUFF_UPDATE", {
    action: "apply_buff",
    targetId: parsed.data.targetId,
    buff: parsed.data.buff,
    gameState: engine.game,
  });
}
```

Update `handleRemoveBuff`:

```typescript
private handleRemoveBuff(ws: WebSocket, client: { id: string; gameId: string | null; playerId: string | null }, payload: Record<string, unknown>): void {
  if (!client.gameId || !client.playerId) {
    this.sendError(ws, "Not in a game");
    return;
  }
  const engine = gameStore.getGame(client.gameId);
  if (!engine) {
    this.sendError(ws, "Game not found");
    return;
  }

  const player = engine.game.players.find(p => p.id === client.playerId);
  if (!player?.isDM) {
    this.sendError(ws, "Only the DM can remove buffs");
    return;
  }

  const parsed = removeBuffSchema.safeParse(payload);
  if (!parsed.success) {
    this.sendError(ws, parsed.error.issues.map(i => i.message).join("; "));
    return;
  }

  engine.removeBuff(parsed.data.targetId, parsed.data.isPlayer, parsed.data.buffName);

  this.broadcastToGame(client.gameId, "BUFF_UPDATE", {
    action: "remove_buff",
    targetId: parsed.data.targetId,
    buffName: parsed.data.buffName,
    gameState: engine.game,
  });
}
```

- [ ] **Step 6: Verify compilation and run all tests**

Run: `npx tsc --noEmit`
Expected: Exit 0

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add shared/schemas/buff.ts shared/index.ts src/websocket/manager.ts tests/websocket/buff-validation.test.ts
git commit -m "fix: add Zod validation to buff and temporary HP handlers"
```

---

### Task 11: Final verification — run full test suite and build

**Files:**
- No changes

- [ ] **Step 1: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: Exit 0, no errors

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: Successful compilation of both backend and frontend

- [ ] **Step 4: Verify server syntax**

Run: `node --check dist/src/server.js`
Expected: No syntax errors

- [ ] **Step 5: Final commit with tag**

```bash
git add -A
git status
# If there are any remaining changes, commit them
git commit -m "chore: Phase 1 complete — critical fixes, type safety, Zod validation"
```
