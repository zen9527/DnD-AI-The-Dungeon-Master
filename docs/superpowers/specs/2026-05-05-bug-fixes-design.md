# Bug Fixes Design: Save, DC Skill Checks, and Character Localization

**Date**: 2026-05-05  
**Status**: Approved  
**Related Issues**: Post-Phase-3 bugs #1 (save), #2 (DC checks), #3 (character i18n)

## Overview

Three critical post-Phase-3 bugs requiring fixes:
1. **Save functionality not working** - Save button has no effect
2. **DC skill checks appear in DM dialogue instead of auto-triggering** - LLM outputs text like "魅力检定，DC 为 15" instead of structured JSON
3. **Player character localization incomplete** - Race/class names display in English instead of localized language

## Design Decisions

### Bug #1: Save Functionality → WebSocket (Recommended)

**Decision**: Use WebSocket message type instead of HTTP API

**Rationale**:
- Consistent with existing architecture (all game operations use WS)
- Real-time response without HTTP overhead
- Can broadcast save confirmation to all players immediately
- Simpler than maintaining separate HTTP + WS paths

**Implementation**:
- Add `SAVE_GAME` (client→server) and `GAME_SAVED` (server→client) message types
- Create `saveGameSchema` in shared/schemas/game.ts
- Implement `handleSaveGame()` in WebSocketManager
- Frontend changes: replace `fetch POST /api/games/${gameId}/save` with `wsManager.send("SAVE_GAME")`

### Bug #2: DC Skill Checks → LLM JSON Output (Option A)

**Decision**: Instruct LLM to output `diceResult` in structured JSON block

**Rationale**:
- Most reliable - structured data vs. text parsing
- Aligns with existing `StructuredResult.diceResult` field
- No regex parsing needed, reduces false positives
- Works across all languages (JSON is language-agnostic)

**Implementation**:
- Modify `prompts.ts` → `buildDDDMechanics()` to add JSON output format requirements
- Explicit instruction: "When skill check needed, output diceResult in JSON block with skill, dc, and roll result"
- `parser.ts` already supports `diceResult`, no changes needed
- `engine.ts` already handles `diceResult` from LLM response

### Bug #3: Character Localization → Frontend i18n Mapping (Recommended)

**Decision**: Use frontend `t()` function to translate race/class names

**Rationale**:
- Consistent with existing i18n system
- Simple and direct - no backend changes needed
- Matches how other UI elements are localized
- Easy to maintain - all translations in locale files

**Implementation**:
- Add `race.*` and `class.*` keys to all 5 locale files (en-US, zh-CN, ja-JP, es-ES, ko-KR)
- Create `getLocalizedRaceName()` and `getLocalizedClassName()` in `public/js/i18n.ts`
- Update `app.ts` → `renderPlayerDetail()` to use localized names
- Verify `character.ts` already uses `getLocalizedNames()` for consistency

## Architecture Changes

### Message Types (src/types/index.ts)

```typescript
export type MessageType =
  // ... existing types ...
  | 'SAVE_GAME'        // NEW: Client requests game save
  | 'GAME_SAVED'       // NEW: Server confirms save success
  // ... existing types ...
```

### Shared Schema (shared/schemas/game.ts)

```typescript
export const saveGameSchema = z.object({
  gameId: z.string(),
});

export type SaveGameInput = z.infer<typeof saveGameSchema>;
```

### System Prompt (src/llm/prompts.ts)

Add to `buildDDDMechanics()`:

```
JSON OUTPUT FORMAT FOR SKILL CHECKS:

When a skill check is required (player attempts uncertain action):
1. Narrate the scene and the challenge
2. In the JSON block, include diceResult with:
   - skill: skill name (e.g., "Persuasion", "Stealth")
   - dc: difficulty class (5-25)
   - success: true/false based on roll vs DC
   - The LLM should simulate the roll result based on narrative context

Example JSON output for a skill check:
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
```

### Locale Files (locales/*.json)

Add race and class translations:

```json
{
  "race": {
    "Human": "人类",
    "Elf": "精灵",
    "Dwarf": "矮人",
    // ... all races ...
  },
  "class": {
    "Wizard": "法师",
    "Fighter": "战士",
    "Rogue": "游荡者",
    // ... all classes ...
  }
}
```

## Testing Strategy

### Unit Tests
- `tests/websocket/manager.test.ts`: Add test for SAVE_GAME handler
- `tests/llm/parser.test.ts`: Verify diceResult parsing from JSON block
- `tests/i18n.test.ts`: Verify race/class name localization

### Integration Tests
- Test save → reload page → verify game state persists
- Test LLM outputs skill check → verify dice roll auto-triggers
- Test character display in zh-CN → verify all names localized

### E2E Tests
- Create game → play session → save → join saved game → verify continuity
- Trigger skill check scenario → verify automatic dice roll + result display
- Switch locale → verify character panel updates correctly

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| LLM doesn't output diceResult consistently | Medium | Add explicit prompt examples, fallback to text parsing if needed |
| Save WebSocket message lost during disconnect | Low | Add reconnection logic, persist to disk immediately |
| Missing locale keys cause display errors | Low | Add fallback to English, comprehensive key audit |

## Rollback Plan

If any fix causes issues:
1. **Save**: Revert to HTTP API implementation (existing routes/games.save.post.ts still works)
2. **DC Checks**: Disable JSON output requirement, fall back to text-only narrative
3. **Localization**: Remove localized name calls, revert to English names

## Success Criteria

- [ ] Save button triggers immediate save + notification
- [ ] Reload page after save → game state restored correctly
- [ ] LLM outputs "魅力检定 DC 15" → automatic dice roll triggered (no text in DM dialogue)
- [ ] Dice result displayed in chat with skill name, DC, success/failure
- [ ] Character panel shows "法师" not "Wizard" in zh-CN locale
- [ ] All 179 tests still pass
- [ ] Build succeeds (`npm run build`)

## Next Steps

1. Write design doc → commit to git
2. Create implementation plan (writing-plans skill)
3. Execute plan with subagent-driven-development
4. Run tests + build verification
5. Push to origin/main
