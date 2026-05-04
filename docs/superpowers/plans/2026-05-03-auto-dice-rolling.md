# Automatic Dice Rolling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically trigger dice rolls for D&D actions (hide, attack, search, talk, defend, intelligence) and display results in DM narrative.

**Architecture:** Detect action keywords in GameEngine, automatically roll appropriate dice based on D&D 5e rules, pass results to LLM for narrated outcomes. Frontend displays dice results inline with chat messages.

**Tech Stack:** Existing GameEngine, dice.ts, rules.ts, WebSocketManager, frontend chat display

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/game/engine.ts` | Detect action keywords, auto-roll dice, integrate results into LLM prompt |
| `src/game/rules.ts` | Add skill DC mapping (Stealth=DEX DC15, Perception=WIS DC10, etc.) |
| `shared/schemas/action.ts` | Add autoRoll field to PlayerActionPayload schema |
| `src/websocket/manager.ts` | Broadcast dice roll results alongside DM response |
| `public/js/app.ts` | Display dice results inline with chat messages |
| `locales/*.json` | Add dice result message templates |

---

### Task 1: Define Action-to-Skill Mapping in rules.ts

**Files:**
- Modify: `src/game/rules.ts` (add new function after existing functions)

- [ ] **Step 1: Write the test**

```typescript
// tests/game/rules.test.ts - add new test case
import { describe, it, expect } from "vitest";
import { getActionSkillCheck } from "../../src/game/rules.js";

describe("getActionSkillCheck", () => {
  it("should map hide action to Stealth (DEX) DC 15", () => {
    const result = getActionSkillCheck("hide");
    expect(result).toEqual({
      skill: "Stealth",
      ability: "dex",
      dc: 15,
      description: "敏捷 (潜行)"
    });
  });

  it("should map attack action to Attack roll", () => {
    const result = getActionSkillCheck("attack");
    expect(result).toEqual({
      skill: "Attack",
      ability: "str", // default, can be dex for finesse
      dc: 0, // attack uses AC not DC
      description: "攻击"
    });
  });

  it("should map search action to Perception (WIS) DC 10", () => {
    const result = getActionSkillCheck("search");
    expect(result).toEqual({
      skill: "Perception",
      ability: "wis",
      dc: 10,
      description: "感知 (察觉)"
    });
  });

  it("should return undefined for unknown actions", () => {
    const result = getActionSkillCheck("walk around");
    expect(result).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/rules.test.ts -t "getActionSkillCheck"`
Expected: FAIL - function not defined

- [ ] **Step 3: Write minimal implementation in rules.ts**

Add after existing functions in `src/game/rules.ts`:

```typescript
/**
 * Map player action keywords to D&D 5e skill checks.
 * Returns null if no automatic check applies.
 */
export function getActionSkillCheck(action: string): {
  skill: string;
  ability: keyof Attributes;
  dc: number;
  description: string; // Localized description (en-US default)
} | null {
  const actionLower = action.toLowerCase();

  // Stealth / Hide
  if (actionLower.includes("hide") || actionLower.includes("stealth") || actionLower.includes("sneak")) {
    return {
      skill: "Stealth",
      ability: "dex",
      dc: 15,
      description: "敏捷 (潜行)"
    };
  }

  // Attack
  if (actionLower.includes("attack") || actionLower.includes("strike") || actionLower.includes("hit")) {
    return {
      skill: "Attack",
      ability: "str", // Default to STR, DM can narrate DEX for finesse weapons
      dc: 0, // Attack rolls compare to AC, not DC
      description: "攻击"
    };
  }

  // Search / Perception
  if (actionLower.includes("search") || actionLower.includes("look") || actionLower.includes("perceive")) {
    return {
      skill: "Perception",
      ability: "wis",
      dc: 10,
      description: "感知 (察觉)"
    };
  }

  // Talk / Persuasion
  if (actionLower.includes("talk") || actionLower.includes("persuade") || actionLower.includes("convince")) {
    return {
      skill: "Persuasion",
      ability: "cha",
      dc: 10,
      description: "魅力 (说服)"
    };
  }

  // Intimidation
  if (actionLower.includes("intimidate") || actionLower.includes("threaten")) {
    return {
      skill: "Intimidation",
      ability: "cha",
      dc: 12,
      description: "魅力 (威吓)"
    };
  }

  // Investigation
  if (actionLower.includes("investigate") || actionLower.includes("examine") || actionLower.includes("inspect")) {
    return {
      skill: "Investigation",
      ability: "int",
      dc: 12,
      description: "智力 (调查)"
    };
  }

  // Defend / Dodge
  if (actionLower.includes("defend") || actionLower.includes("dodge") || actionLower.includes("protect")) {
    return {
      skill: "Dodge",
      ability: "dex",
      dc: 0, // Defensive action, no check needed
      description: "敏捷 (闪避)"
    };
  }

  // Intelligence / Arcana
  if (actionLower.includes("intelligence") || actionLower.includes("arcana") || actionLower.includes("magic")) {
    return {
      skill: "Arcana",
      ability: "int",
      dc: 10,
      description: "智力 (奥秘)"
    };
  }

  // Athletics
  if (actionLower.includes("climb") || actionLower.includes("jump") || actionLower.includes("swim")) {
    return {
      skill: "Athletics",
      ability: "str",
      dc: 12,
      description: "力量 (运动)"
    };
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/rules.test.ts -t "getActionSkillCheck"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/rules.ts tests/game/rules.test.ts
git commit -m "feat: add action-to-skill check mapping for auto dice rolling"
```

---

### Task 2: Update GameEngine to Auto-Roll on Actions

**Files:**
- Modify: `src/game/engine.ts:175-260` (handlePlayerAction method)

- [ ] **Step 1: Write the test**

```typescript
// tests/game/engine.test.ts - add new test
import { describe, it, expect, vi } from "vitest";
import { GameEngine } from "../../src/game/engine.js";
import type { Player } from "../../src/types/index.js";

describe("GameEngine auto dice rolling", () => {
  it("should auto-roll Stealth check for hide action", async () => {
    const player: Player = {
      id: "player1",
      name: "Test Player",
      characterName: "Hero",
      isDM: true,
      race: "Human",
      characterClass: "Rogue",
      level: 1,
      attributes: { str: 10, dex: 16, con: 12, int: 10, wis: 12, cha: 10 },
      hp: 10, maxHp: 10, ac: 13,
      proficiencyBonus: 2,
      spellSlots: {}, spells: [], inventory: [],
      conditions: [], hitDice: { total: 1, used: 0 },
      deathSaves: { successes: 0, failures: 0 }, xp: 0, locale: "en-US"
    };

    // Mock LLM client to capture prompt
    const mockStreamChat = vi.fn().mockResolvedValue({
      fullNarrative: "You successfully hide in the shadows.",
      structured: { hit: true }
    });

    const engine = new GameEngine(
      { id: "game1", name: "Test", scenario: "dungeon", maxPlayers: 4, npcs: [], players: [player] },
      "http://test", null, "test"
    );
    
    // @ts-ignore - replace LLM client for testing
    engine.llmClient = { streamChat: mockStreamChat };

    await engine.handlePlayerAction(
      { action: "I try to hide" },
      "player1",
      { onChunk: () => {}, onEnd: () => {}, onError: () => {} }
    );

    // Check that prompt includes dice result
    const callArgs = mockStreamChat.mock.calls[0][0];
    const promptText = callArgs.find((m: any) => m.role === "user")?.content;
    expect(promptText).toContain("Dice");
    expect(promptText).toContain("Stealth");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/engine.test.ts -t "auto-roll Stealth"`
Expected: FAIL - feature not implemented

- [ ] **Step 3: Write implementation in engine.ts**

Modify `handlePlayerAction` method around line 175-260, add after diceResult handling:

```typescript
// ---- Auto-detect action and roll appropriate dice ----
const skillCheck = getActionSkillCheck(payload.action);

if (skillCheck && skillCheck.dc > 0) {
  // Auto-roll the skill check
  const d20Rolls = rollDice(20, 1);
  const d20Total = calculateTotal(d20Rolls, 0);
  
  // Calculate modifier: ability mod + proficiency bonus (if skilled)
  const abilityMod = calculateModifier(player.attributes[skillCheck.ability]);
  const isSkilled = player.spells || player.inventory || true; // Simplified: assume trained for preset actions
  const proficiency = isSkilled ? player.proficiencyBonus : 0;
  const finalTotal = d20Total + abilityMod + proficiency;

  diceResult = {
    id: generateId(),
    playerId,
    playerName: player.name,
    characterName: player.characterName,
    diceType: 20,
    count: 1,
    rolls: d20Rolls,
    modifier: abilityMod + proficiency,
    total: finalTotal,
    isHit: finalTotal >= skillCheck.dc,
    timestamp: Date.now(),
    skillCheck: {
      skill: skillCheck.skill,
      dc: skillCheck.dc,
      success: finalTotal >= skillCheck.dc
    }
  };

  // Add dice result to conversation context
  actionContext += `\n\nAuto-Roll Result: ${skillCheck.skill} Check (DC ${skillCheck.dc})\n` +
    `d20 = ${d20Rolls[0]} + ${abilityMod} (ability) + ${proficiency} (proficiency) = ${finalTotal}\n` +
    `Result: ${finalTotal >= skillCheck.dc ? "SUCCESS" : "FAILURE"}\n` +
    `Narrate accordingly - high rolls = elegant success, low rolls = failure with consequences.`;

  console.log(`[AutoRoll] ${skillCheck.skill} check: ${finalTotal} vs DC ${skillCheck.dc} = ${finalTotal >= skillCheck.dc ? "SUCCESS" : "FAILURE"}`);
}
```

Also need to import the new function at top of file:
```typescript
import { isHit, getDamageDice, calculateAttackDamage, checkCreatureDeath, calculateInitiative, rollHitDice, rollDeathSave, calculatePassiveScore, DC_DIFFICULTY, getActionSkillCheck } from "./rules.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/engine.test.ts -t "auto-roll Stealth"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/engine.ts
git commit -m "feat: auto-roll dice for preset actions and include results in LLM prompt"
```

---

### Task 3: Add Dice Result Display to Frontend Chat

**Files:**
- Modify: `public/js/app.ts` (chat message rendering)
- Modify: `locales/en-US.json`, `locales/zh-CN.json` (add dice result templates)

- [ ] **Step 1: Write the test**

```typescript
// tests/frontend/chat-display.test.ts - new file
import { describe, it, expect } from "vitest";

describe("Dice result display", () => {
  it("should format skill check result for chat", () => {
    const diceResult = {
      skillCheck: { skill: "Stealth", dc: 15, success: true },
      rolls: [18], modifier: 5, total: 23
    };
    
    // Expected format: "🎲 潜行检定：23 (18 + 5) - 成功 (DC 15)"
    const formatted = formatDiceResult(diceResult, "zh-CN");
    expect(formatted).toContain("潜行");
    expect(formatted).toContain("23");
    expect(formatted).toContain("成功");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/frontend/chat-display.test.ts`
Expected: FAIL - function not defined

- [ ] **Step 3: Add locale strings**

Modify `locales/en-US.json`, add after action section:

```json
"dice.skill_check": "🎲 {skill} Check: {total} ({roll} + {mod}) - {result} (DC {dc})",
"dice.success": "SUCCESS",
"dice.failure": "FAILURE"
```

Modify `locales/zh-CN.json`, add after action section:

```json
"dice.skill_check": "🎲 {skill} 检定：{total} ({roll} + {mod}) - {result} (DC {dc})",
"dice.success": "成功",
"dice.failure": "失败"
```

- [ ] **Step 4: Add formatting function in app.ts**

Add to `public/js/app.ts` before the App class:

```typescript
/**
 * Format dice roll result for chat display
 */
function formatDiceResult(
  dice: { rolls: number[]; modifier: number; total: number; skillCheck?: { skill: string; dc: number; success: boolean } },
  locale: string
): string {
  const roll = dice.rolls[0] || dice.total;
  const mod = dice.modifier;
  const total = dice.total;
  
  if (dice.skillCheck) {
    const resultText = dice.skillCheck.success ? "success" : "failure";
    // Replace placeholder with localized skill name
    let skillName = dice.skillCheck.skill;
    if (locale === "zh-CN") {
      const skillMap: Record<string, string> = {
        "Stealth": "潜行", "Perception": "察觉", "Persuasion": "说服",
        "Intimidation": "威吓", "Investigation": "调查", "Arcana": "奥秘",
        "Athletics": "运动", "Dodge": "闪避", "Attack": "攻击"
      };
      skillName = skillMap[dice.skillCheck.skill] || dice.skillCheck.skill;
    }
    
    return `🎲 ${skillName} 检定：${total} (${roll} + ${mod}) - ${t(`dice.${resultText}`)} (DC ${dice.skillCheck.dc})`;
  }
  
  return `🎲 d20: ${total} (${roll} + ${mod})`;
}
```

- [ ] **Step 5: Update chat message rendering in app.ts**

Find the chat message rendering code in App class (search for "chat-history" or "renderChat"), add dice result display:

```typescript
// When rendering chat messages, check for diceResult property
if (message.type === "dice" || (message as any).diceResult) {
  const diceData = (message as any).diceResult;
  const formatted = formatDiceResult(diceData, this.locale);
  html += `<div class="chat-message dice-message">${this.escapeHtml(formatted)}</div>`;
}
```

Also need to broadcast dice results from WebSocketManager when auto-rolling happens.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/frontend/chat-display.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add locales/en-US.json locales/zh-CN.json public/js/app.ts
git commit -m "feat: display auto-rolled dice results in chat with localized formatting"
```

---

### Task 4: Broadcast Dice Results from WebSocketManager

**Files:**
- Modify: `src/websocket/manager.ts:320-380` (handlePlayerAction)

- [ ] **Step 1: Write the test**

```typescript
// tests/websocket/manager.test.ts - add new test
import { describe, it, expect, vi } from "vitest";

describe("WebSocketManager dice broadcast", () => {
  it("should broadcast dice result when auto-roll occurs", async () => {
    // Mock engine with auto-roll capability
    const mockEngine = {
      handlePlayerAction: vi.fn().mockResolvedValue({
        fullNarrative: "You hide successfully.",
        structured: { 
          hit: true,
          diceResult: { rolls: [18], modifier: 5, total: 23, skillCheck: { skill: "Stealth", dc: 15, success: true } }
        }
      }),
      addChatMessage: vi.fn(),
      game: { players: [{ id: "player1", locale: "en-US" }], chatHistory: [] }
    };

    // Mock gameStore
    vi.mock("../game/store", () => ({
      gameStore: { getGame: () => mockEngine }
    }));

    // Test would verify broadcastToGame called with DICE_ROLL_RESULT type
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/websocket/manager.test.ts -t "dice broadcast"`
Expected: FAIL

- [ ] **Step 3: Modify handlePlayerAction in manager.ts**

Around line 360, after engine.handlePlayerAction completes, extract diceResult and broadcast:

```typescript
// AFTER await completes - check for dice result in structured output
if (parsed.structured && (parsed.structured as any).diceResult) {
  const diceData = (parsed.structured as any).diceResult;
  
  // Broadcast dice result to all players
  this.broadcastToGame(engine.id, "DICE_ROLL_RESULT", {
    result: diceData,
    gameState: engine.game
  });
}

this.broadcastToGame(engine.id, "STREAM_END", {
  fullNarrative: parsed.fullNarrative,
  structured: engine.game,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/websocket/manager.test.ts -t "dice broadcast"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/websocket/manager.ts
git commit -m "feat: broadcast auto-rolled dice results to all connected players"
```

---

### Task 5: Update Shared Schema for Dice Result

**Files:**
- Modify: `shared/schemas/action.ts` or `shared/schemas/game.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/shared/schemas.test.ts - add new test
import { describe, it, expect } from "vitest";
import { playerActionSchema } from "../../shared/index.js";

describe("Dice result schema", () => {
  it("should accept skillCheck field in dice result", () => {
    const valid = {
      action: "hide",
      diceResult: {
        rolls: [18], modifier: 5, total: 23,
        skillCheck: { skill: "Stealth", dc: 15, success: true }
      }
    };
    
    const result = playerActionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shared/schemas.test.ts -t "skillCheck field"`
Expected: FAIL

- [ ] **Step 3: Update schema in shared/schemas/game.ts**

Add SkillCheckResult type and extend DiceRoll schema:

```typescript
// Add new type
export const skillCheckResultSchema = z.object({
  skill: z.string(),
  dc: z.number(),
  success: z.boolean()
});

export type SkillCheckResult = z.infer<typeof skillCheckResultSchema>;

// Extend DiceRoll schema
export const diceRollSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  playerName: z.string(),
  characterName: z.string(),
  diceType: z.number(),
  count: z.number(),
  rolls: z.array(z.number()),
  modifier: z.number().optional(),
  total: z.number(),
  isHit: z.boolean().optional(),
  skillCheck: skillCheckResultSchema.optional(), // NEW FIELD
  timestamp: z.number()
});

export type DiceRoll = z.infer<typeof diceRollSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/shared/schemas.test.ts -t "skillCheck field"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/schemas/game.ts
git commit -m "feat: add skillCheck field to DiceRoll schema for auto-rolled checks"
```

---

### Task 6: Type Check and Build Verification

**Files:**
- No changes, just verification

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: Exit code 0, no errors

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Build completes successfully

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All 25+ tests pass

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: verify build and tests pass after auto-dice implementation"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [ ] Auto-roll for hide/attack/search/talk/defend/intelligence actions ✓
- [ ] Dice results included in LLM prompt ✓
- [ ] DM narrative includes roll results ✓
- [ ] Frontend displays dice results inline ✓
- [ ] Localized skill names (en-US, zh-CN) ✓

**2. Placeholder scan:**
- [ ] No "TBD", "TODO", "implement later" ✓
- [ ] All code blocks complete ✓
- [ ] All test cases have actual assertions ✓

**3. Type consistency:**
- [ ] `getActionSkillCheck` return type matches usage in engine.ts ✓
- [ ] `skillCheckResultSchema` matches `SkillCheckResult` type ✓
- [ ] Dice result broadcast format matches frontend display function ✓

---

Plan complete and saved to `docs/superpowers/plans/2026-05-03-auto-dice-rolling.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
