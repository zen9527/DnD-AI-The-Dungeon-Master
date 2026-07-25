# DnD AI Refactor Specification

**Date:** 2026-07-24  
**Status:** Approved  
**Approach:** Phased (4 phases)

---

## Phase 1: Critical Fixes

### 1.1 Bug Fixes

| Bug | Location | Fix |
|-----|----------|-----|
| `wsManager.addMessageHandler` does not exist | `public/js/app.ts:1459` | Replace with `wsManager.on("DM_CONTROL_UPDATE", ...)` |
| `showNotification` called with invalid type `"warning"` | `public/js/app.ts:410` | Add `"warning"` to `NotificationType` union and create corresponding CSS class |
| `gameState.subscribe` callback signature mismatch | `public/js/game-state.ts:147` | Pass all 7 fields in initial callback invocation to match `notifyListeners()` |
| Hardcoded `"en-US"` in engine combat narratives | `src/game/engine.ts:164,191` | Pass player's locale from game state instead of hardcoded `"en-US"` |

### 1.2 Type Safety

**Replace 14 `any` types:**

| Location | Current | Replacement |
|----------|---------|-------------|
| `engine.ts:81` | `get initiativeOrder(): any[]` | `InitiativeEntry[]` |
| `engine.ts:1015` | `addItemToInventory(playerId: string, item: any)` | `Item` from shared schema |
| `engine.ts:1085` | `getPlayerInventory(playerId: string): any[]` | `Item[]` |
| `engine.ts:1095` | `getEquippedItems(...): { weapon?: any; armor?: any }` | `Item` |
| `engine.ts:1140` | `recalculatePlayerAC(player: any)` | `Player` |
| `engine.ts:1232` | `(b: any) => b.name === buff.name` | `Buff` type |
| `engine.ts:1252` | `buffs.filter((b: any) => ...)` | `Buff` type |
| `game-state.ts:10,23,34,72,85` | `initiativeOrder: any[]` (5x) | `InitiativeEntry[]` |
| `app.ts:506` | `item?: any` | `Item` |
| `app.ts:1285` | `renderConditionCheckboxes(npc: any)` | `NPC` |

**Add Zod validation to 7 unvalidated WebSocket handlers:**

1. `handleDiceRoll` — validate against `diceRollSchema`
2. `handleNPCCreate` — validate against NPC creation schema
3. `handleEventCreate` — validate against event schema
4. `handleEquipWeapon` — validate against `equipItemSchema`
5. `handleEquipArmor` — validate against `equipItemSchema`
6. `handleUseItem` — validate against `useItemSchema`
7. `handleApplyTemporaryHP`, `handleApplyBuff`, `handleRemoveBuff` — create inline Zod schemas if none exist

---

## Phase 2: Dead Code & Duplication Cleanup

### 2.1 Dead Code Removal (19 items)

**`src/game/dice.ts`:**
- Remove `handleDeath()` (never called)
- Remove `rollWithAdvantage()` (never called)
- Remove `rollWithDisadvantage()` (never called)
- Remove `calculateDamage()` (never imported externally)
- Remove `calculateAC()` (never imported; `rules.ts` has its own)
- Remove `calculateHit()` (only used by `rules.ts` wrapper; inline or move)

**`src/game/rules.ts`:**
- Remove `getConditionModifier()` (never called)
- Remove `applyCondition()` (never called; engine has its own)
- Remove `removeCondition()` (never called; engine has its own)
- Make `getHitDice()` private/internal (only used by `rollHitDice()`)
- Remove `getLevelUpBenefits()` (never called; engine reimplements inline)
- Remove `getCombinedCheckDescription()` (never called)

**`shared/schemas/`:**
- Remove `combatEndSchema` (never used for validation)
- Remove `turnAdvanceSchema` (never used for validation)
- Remove `combatStateSchema` (output-only, never validated)
- Remove `npcCreateEnhancedSchema` (exported but never used)
- Remove `playerResetXpSchema` (not exported, never used)
- Remove `npcListSchema` (not exported, never used)
- Remove `playerListSchema` (not exported, never used)
- Remove unused item schemas: `itemSchema`, `equipItemSchema`, `unequipItemSchema`, `useItemSchema` — OR wire them into handler validation (Phase 1.2)

**`public/js/game-state.ts`:**
- Remove `applyStreamResult()` (never called; `STREAM_END` handler bypasses it)

### 2.2 Extract Shared Frontend Utilities

**Create `public/js/utils.ts`:**
```typescript
export function escapeHtml(text: string): string { ... }
export function showNotification(message: string, type: NotificationType): void { ... }
export function renderLocaleDropdown(container: HTMLElement, currentLocale: string, onChange: (locale: string) => void): void { ... }
export function getLocaleDisplayName(locale: string): string { ... }
```

**Update consumers:**
- `public/js/app.ts` — import from `./utils`
- `public/js/character.ts` — import from `./utils`
- `public/js/action-bar.ts` — import from `./utils`
- Remove duplicate implementations

### 2.3 Add Missing Abstractions

**Player factory — `src/game/player-factory.ts`:**
```typescript
export function createPlayer(config: { id: string; name: string; isDM?: boolean; race?: string; class?: string }): Player {
  return {
    id: config.id,
    name: config.name,
    isDM: config.isDM ?? false,
    race: config.race ?? "",
    class: config.class ?? "",
    hp: 10,
    maxHp: 10,
    ac: 11,
    hitDice: { ... },
    deathSaves: { success: 0, failure: 0 },
    // ... other defaults
  };
}
```

**DM guard — `src/websocket/guards.ts`:**
```typescript
export function requireDM(
  client: WebSocketClient,
  engine: GameEngine,
  ws: WebSocket
): { engine: GameEngine; player: Player } | null {
  // Returns null and sends error if not DM
}
```

Replace ~12 repeated auth check blocks in `manager.ts` with `requireDM()` calls.

---

## Phase 3: God Object Decomposition

### 3.1 GameEngine Decomposition

**Current:** `src/game/engine.ts` (1324 lines)

**Target structure:**

| File | Lines (est.) | Responsibility |
|------|-------------|----------------|
| `src/game/engine.ts` | ~400 | Core orchestration: `handlePlayerAction`, game state, chat, LLM interaction |
| `src/game/combat.ts` | ~300 | Initiative, turn management, conditions, death saves, combat start/end |
| `src/game/inventory.ts` | ~200 | Add/remove items, equip/unequip weapon/armor, use items, recalculate AC |
| `src/game/leveling.ts` | ~150 | XP tracking, level up logic, hit dice rolling |
| `src/game/llm-interaction.ts` | ~150 | Story summary generation, LLM prompt construction integration |

**Pattern:** Composition. `GameEngine` holds instances of `CombatService`, `InventoryService`, `LevelingService`. Delegates to them. Services receive `gameState` reference and `locale` for message generation.

### 3.2 WebSocketManager Decomposition

**Current:** `src/websocket/manager.ts` (1522 lines)

**Target structure:**

| File | Lines (est.) | Responsibility |
|------|-------------|----------------|
| `src/websocket/manager.ts` | ~400 | Connection management, message routing, handler registry, game lifecycle |
| `src/websocket/handlers/game.ts` | ~250 | `handleCreateGame`, `handleJoinGame`, `handleLeaveGame` |
| `src/websocket/handlers/combat.ts` | ~200 | `handleCombatStart`, `handleCombatEnd`, `handleTurnAdvance`, `handleDiceRoll` |
| `src/websocket/handlers/dm.ts` | ~250 | All DM-only handlers (NPC CRUD, XP awards, buffs, conditions) |
| `src/websocket/handlers/inventory.ts` | ~150 | Item/equip/unequip/use handlers |
| `src/websocket/handlers/chat.ts` | ~100 | Chat messages, emotes, private chat |

**Pattern:** Handler registry. Each handler file exports a `register(manager)` function that registers its message handlers. Manager calls all `register` functions during setup.

### 3.3 App Decomposition (Frontend)

**Current:** `public/js/app.ts` (1539 lines)

**Target structure:**

| File | Lines (est.) | Responsibility |
|------|-------------|----------------|
| `public/js/app.ts` | ~500 | Core orchestration, game flow, WS event wiring, settings modal |
| `public/js/views/combat-panel.ts` | ~250 | Combat UI: initiative list, turn indicator, combat controls |
| `public/js/views/dm-controls.ts` | ~300 | DM panel: NPC management, player XP, buffs, conditions |
| `public/js/views/inventory-panel.ts` | ~200 | Inventory list, equip/unequip, use items |
| `public/js/views/chat.ts` | ~200 | Chat message rendering, stream display, dice roll display |

**Pattern:** View classes. Each view class has `render(state)` and `bindEvents()` methods. App instantiates views and passes state updates.

### 3.4 Move parseLLMResponse to Shared

- Move `src/llm/parser.ts` logic to `shared/utils/parseLLMResponse.ts`
- Update `src/llm/client.ts` import
- Update `public/js/game-state.ts` import (remove `@llm` alias dependency)
- Keep `src/llm/parser.ts` as re-export for backward compatibility, or update all imports

---

## Phase 4: i18n Fixes

### 4.1 Extract Hardcoded Strings

**Backend (`src/game/rules.ts`):**
- 9 hardcoded Chinese strings in `getActionSkillCheck()` descriptions (lines 136-160): `"敏捷 (闪避)"`, `"攻击"`, `"魅力 (说服)"`, etc.
- Move to locale files or return skill keys that frontend localizes

**Frontend (`public/js/app.ts`):**
- Line 41: `"检定"` -> use `t("skillCheck")`
- Line 701: `"正在保存..."` -> use `t("saving")`
- Lines 27-38: Hardcoded Chinese skill name map -> move to locale JSON files
- Line 1349: `confirm("Delete ${npcName}?")` -> use `t("confirmDelete")`

### 4.2 Fix LOCALE_NATIVE

Current: `LOCALE_NATIVE` is identical to `LOCALE_DISPLAY`.

Fix to show actual native-language names:
```typescript
export const LOCALE_NATIVE: Record<string, string> = {
  "en-US": "English",
  "zh-CN": "简体中文",
  "ja-JP": "日本語",
  "es-ES": "Español",
  "ko-KR": "한국어",
};
```

### 4.3 Locale File Completeness

Ensure all 5 locale files (`en-US`, `zh-CN`, `ja-JP`, `es-ES`, `ko-KR`) have:
- All keys from `en-US.json` (source of truth)
- New keys added in Phase 4.1
- Consistent structure

---

## Verification Plan

Each phase concludes with:
1. `npx tsc --noEmit` — zero type errors
2. `npx vitest run` — all existing tests pass
3. `npm run build` — successful compilation
4. Manual smoke test: create game, join game, roll dice, combat, chat

---

## Out of Scope

- Rewriting the CSS theme system
- Adding new game features
- Changing the WebSocket protocol
- Migrating from Express to another framework
- Adding a database (stays in-memory + file save)
