# DnD AI Refactor — Completion Report

**Date:** 2026-07-26
**Covers:** `docs/superpowers/specs/2026-07-24-refactor-design.md` (all 4 phases)
**Status:** Complete

---

## Phase status

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Bug fixes, `any` removal, Zod validation | Done (commits `63afcdb`…`6dd74bf`) |
| 2.1 | Dead code removal in `dice.ts`, `rules.ts`, `shared/schemas` | Done (`6a6221e`) |
| 2.2 | Shared frontend utilities (`escapeHtml`, `showNotification`, locale dropdown) | Done (`6c6cca3`) |
| 2.3 | `player-factory.ts`, `websocket/guards.ts` | Done |
| 3.1 | `GameEngine` decomposition | Done |
| 3.2 | `WebSocketManager` decomposition | Done |
| 3.3 | Frontend `App` decomposition | Done |
| 3.4 | `parseLLMResponse` moved to `shared/` | Done |
| 4.1 | Hardcoded strings extracted | Done |
| 4.2 | `LOCALE_NATIVE` | Was already fixed |
| 4.3 | Locale file completeness | Done |

## Size before / after

| File | Before | After |
|------|--------|-------|
| `src/websocket/manager.ts` | 1564 | 171 |
| `src/game/engine.ts` | 1331 | 289 |
| `public/js/app.ts` | 1508 | 456 |

No file in the codebase now exceeds ~500 lines.

## Deviations from the design

- **Extra modules.** The design listed five frontend view files; the split produced
  seven — `settings-modal.ts` and `lobby.ts` were separated as well, because the
  settings dialog alone was ~200 lines of the 500-line budget the design gave `app.ts`.
- **`GameState` container.** The design said "services receive `gameState` reference".
  That became an explicit `GameState` class with a `mutate()` method, because the
  snapshot-staleness bug below is only structurally preventable that way.
- **`rules.ts` `description` field removed rather than localized.** Section 4.1 asked
  for the nine hardcoded Chinese strings in `getActionSkillCheck()` to move to locale
  files. The field had no callers and duplicated `skill` + `ability`, so it was deleted
  instead. Skill names are localized on the client via the new `skill.*` keys.
- **Frontend type-checking added.** Not in the design. `public/` was excluded from
  `tsconfig.json` and only ever transpiled by Vite, so no frontend TypeScript had ever
  been checked. Turning it on found four live bugs (below), so it was kept and wired
  into `npm run build`.

## Bugs found and fixed during the refactor

These were not in the design's bug list; they surfaced while moving the code.

**Server**

1. Most `GameEngine` mutators never invalidated the cached snapshot, so `engine.game`
   returned stale state. Handlers broadcast `gameState: engine.game` immediately after
   mutating, so chat, DM controls, inventory and NPC updates could all ship the previous
   state to clients. Fixed structurally by routing every write through `GameState.mutate()`.
2. `SET_LOCALE` mutated the cached snapshot instead of the live game, so locale changes
   were discarded on the next mutation.
3. `CREATE_GAME` broadcast a fallback narrative on the first retryable LLM error even
   though a retry was already scheduled, producing a duplicate opening scene.
4. The disconnect handler called `addChatMessage` for the player it had just removed,
   which throws.
5. `INVENTORY_ADD_ITEM` was unvalidated and cast item stats through `any`.
6. `JOIN_GAME` never enforced `maxPlayers`; the check existed only in an unused
   `GameStore.joinGame` method.
7. `reduceBuffDurations()` was never called, so buffs and temporary HP never expired.
   Now ticks when a combat round wraps.
8. `getCurrentPlayer()` could return an NPC typed as a `Player` outside combat.
9. `cleanupEmptyGames()` was never called; abandoned games leaked in memory.

**Frontend** (all found by enabling type-checking)

10. `ActionBar`'s constructor called `this.setupFreeTextListeners()`, which does not
    exist — the action bar threw on construction and failed to mount.
11. `gameState.npcs` / `gameState.players` were read by the DM panel but never defined
    on `GameState`, so the panel always showed zero NPCs and an empty player dropdown.
12. Potion buttons filtered inventory on `type === "potion"`, which is not in the `Item`
    type union, so potions never appeared.
13. The inventory "Unequip" button sent `EQUIP_WEAPON`/`EQUIP_ARMOR`, re-equipping the
    item instead of removing it.
14. The DM's create-NPC form collected HP/maxHP/AC and discarded them. `npcSchema` now
    accepts an optional stat block.

**i18n**

15. `ja-JP`, `es-ES` and `ko-KR` were each missing 53 keys and rendered raw key strings
    across the combat, inventory, equipment and buff UI.
16. `en-US` was missing the entire `dm_control.*` family that the DM panel uses.
17. `dm_control.level_up` served as both a section heading and a notification with
    different placeholders; the notification now uses `dm_control.player_leveled`.

## Verification

- `npm run typecheck` — clean (backend and frontend)
- `npx vitest run` — 286 tests across 19 files
- `npm run build` — succeeds
- End-to-end smoke test against the running server: 17/17 checks, covering game
  creation, the lobby API, NPC creation with a stat block, combat start and initiative,
  DM HP updates (verifying non-stale broadcast state), server-side dice rolls, Zod
  rejection of invalid dice, chat, `SET_LOCALE` persistence, and save.

## Not addressed

Out of scope per the design, and still true:

- The CSS theme system was not rewritten.
- No new game features.
- The WebSocket protocol is unchanged.
- Storage is still in-memory plus JSON files on disk.

Known remaining rough edges, deliberately left alone:

- `public/js/character.ts` (647 lines) was not decomposed; it was not in the design's
  scope and has no view-layer duplication with `app.ts`.
- Auto-join after a "Load" reload still fabricates a placeholder character, because the
  original character data is not persisted client-side.
