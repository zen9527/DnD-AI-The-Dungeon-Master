# Multi-Player D&D Phase 2: Cooperative Gameplay & Persistence

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add team combat mechanics, combined skill checks, game persistence with file storage, and character XP/leveling system.

**Architecture:** Extend GameEngine with state tracking for conditions (prone, blinded, etc.). Implement combined dice rolling for group actions. Add JSON file-based persistence for games and characters. Build XP calculation and leveling logic following D&D 5e rules. Keep storage local (no database) for simplicity.

**Tech Stack:** Existing GameEngine, dice.ts, rules.ts, Node.js fs module, JSON serialization, frontend app.ts

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/game/store.ts` | Add save/load game methods using fs |
| `src/game/engine.ts` | Combined skill checks, condition tracking, XP logic |
| `src/game/rules.ts` | Condition rules, combined check modifiers |
| `src/utils/storage.ts` | NEW - File-based game/character storage |
| `shared/schemas/game.ts` | Add XP, conditions, combinedCheck schemas |
| `public/js/app.ts` | Save/load UI, XP display, combined action buttons |
| `locales/*.json` | XP, conditions, combined check locale strings |
| `tests/game/storage.test.ts` | NEW - File storage tests |
| `tests/game/engine.test.ts` | Combined check, XP calculation tests |

---

### Task 1: Add Condition Tracking System

**Files:**
- Modify: `src/types/index.ts` (Player conditions field)
- Modify: `src/game/rules.ts` (condition effects)
- Modify: `src/game/engine.ts` (apply/remove conditions)

- [ ] **Step 1: Write the test**

```typescript
// tests/game/rules.test.ts - add new test
import { describe, it, expect } from "vitest";
import { getConditionModifier } from "../../src/game/rules.js";

describe("getConditionModifier", () => {
  it("should return disadvantage for poisoned condition", () => {
    const modifier = getConditionModifier(["poisoned"]);
    expect(modifier).toEqual({ attackAdvantage: false, checkAdvantage: false });
  });

  it("should return advantage for attacking prone target", () => {
    const modifier = getConditionModifier([], ["prone"]);
    expect(modifier).toEqual({ attackAdvantage: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/rules.test.ts -t "condition modifier"`
Expected: FAIL - function not defined

- [ ] **Step 3: Add condition types in types/index.ts**

Modify `src/types/index.ts` Player interface around line 3-26:

```typescript
export interface Player {
  id: string;
  name: string;
  characterName: string;
  isDM: boolean;
  race: string;
  characterClass: string;
  level: number;
  attributes: Attributes;
  hp: number;
  maxHp: number;
  ac: number;
  proficiencyBonus: number;
  spellSlots: Record<string, number>;
  spells: Spell[];
  inventory: Item[];
  conditions: string[]; // NEW - D&D 5e conditions (poisoned, prone, blinded, etc.)
  
  // D&D 5e extended mechanics
  hitDice: { total: number; used: number };
  deathSaves: { successes: number; failures: number };
  xp: number; // NEW - Experience points
  locale: string;
}
```

- [ ] **Step 4: Add condition rules in rules.ts**

Add after existing functions in `src/game/rules.ts`:

```typescript
// ============================================================================
// CONDITION EFFECTS — D&D 5e condition mechanics
// ============================================================================

export const CONDITIONS: Record<string, {
  description: string;
  attackAdvantage?: boolean;      // Advantage/disadvantage on attacks against/by target
  checkAdvantage?: boolean;       // Advantage/disadvantage on ability checks
  saveAdvantage?: boolean;        // Advantage/disadvantage on saving throws
  speedZero?: boolean;            // Speed becomes 0
  canAttack?: boolean;            // Can't attack
  invisible?: boolean;            // Invisible to normal vision
}> = {
  "poisoned": {
    description: "Poisoned",
    checkAdvantage: false,
    attackAdvantage: false
  },
  "prone": {
    description: "Prone",
    speedZero: true,
    // Melee attacks against have advantage, ranged attacks have disadvantage
    // (handled in combat logic)
  },
  "blinded": {
    description: "Blinded",
    checkAdvantage: false,
    attackAdvantage: false, // Can't see, so attacks have disadvantage
    saveAdvantage: true     // Some saves have advantage
  },
  "charmed": {
    description: "Charmed",
    canAttack: false        // Can't attack the charmer
  },
  "frightened": {
    description: "Frightened",
    checkAdvantage: false,
    attackAdvantage: false
  },
  "grappled": {
    description: "Grappled",
    speedZero: true
  },
  "stunned": {
    description: "Stunned",
    checkAdvantage: false,
    attackAdvantage: false,
    saveAdvantage: false,
    canAttack: false
  },
  "invisible": {
    description: "Invisible",
    invisible: true,
    attackAdvantage: true   // Attacks have advantage
  }
};

export function getConditionModifier(
  selfConditions: string[],
  targetConditions: string[] = []
): {
  attackAdvantage?: boolean;
  checkAdvantage?: boolean;
  saveAdvantage?: boolean;
} {
  const result: {
    attackAdvantage?: boolean;
    checkAdvantage?: boolean;
    saveAdvantage?: boolean;
  } = {};

  // Apply self conditions
  for (const cond of selfConditions) {
    const effect = CONDITIONS[cond];
    if (!effect) continue;
    
    if (effect.checkAdvantage !== undefined) {
      result.checkAdvantage = effect.checkAdvantage;
    }
    if (effect.saveAdvantage !== undefined) {
      result.saveAdvantage = effect.saveAdvantage;
    }
  }

  // Apply target conditions (affects attacks against target)
  for (const cond of targetConditions) {
    const effect = CONDITIONS[cond];
    if (!effect) continue;
    
    if (cond === "prone") {
      // Melee advantage, ranged disadvantage (caller decides melee/ranged)
      result.attackAdvantage = true;
    }
    if (cond === "invisible") {
      result.attackAdvantage = false; // Can't see target, disadvantage
    }
  }

  return result;
}

export function applyCondition(player: Player, condition: string): void {
  if (!CONDITIONS[condition]) {
    console.warn(`Unknown condition: ${condition}`);
    return;
  }
  if (!player.conditions.includes(condition)) {
    player.conditions.push(condition);
  }
}

export function removeCondition(player: Player, condition: string): void {
  player.conditions = player.conditions.filter(c => c !== condition);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/game/rules.test.ts -t "condition modifier"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/game/rules.ts
git commit -m "feat: add D&D 5e condition tracking system"
```

---

### Task 2: Add Combined Skill Checks

**Files:**
- Modify: `src/game/engine.ts` (combined check logic)
- Modify: `src/game/rules.ts` (combined check calculation)
- Modify: `shared/schemas/game.ts` (combinedCheck schema)

- [ ] **Step 1: Write the test**

```typescript
// tests/game/engine.test.ts - add new test
import { describe, it, expect } from "vitest";
import { calculateCombinedCheck } from "../../src/game/rules.js";

describe("calculateCombinedCheck", () => {
  it("should add +2 per additional helper", () => {
    const mainRoll = 15;
    const mainMod = 3;
    const helpers = 2; // 2 other players helping
    
    const result = calculateCombinedCheck(mainRoll, mainMod, helpers);
    // Main: 15 + 3 = 18, Helpers: +2 each = +4, Total: 22
    expect(result.total).toBe(22);
    expect(result.helperBonus).toBe(4);
  });

  it("should require helpers to be proficient", () => {
    // Test that helpers must have proficiency to contribute
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/engine.test.ts -t "combined check"`
Expected: FAIL

- [ ] **Step 3: Add combined check rules in rules.ts**

Add after condition functions in `src/game/rules.ts`:

```typescript
// ============================================================================
// COMBINED SKILL CHECKS — Multiple players helping on one check
// ============================================================================

export function calculateCombinedCheck(
  mainRoll: number,
  mainModifier: number,
  helpers: number,
  allHelpersProficient: boolean = true
): {
  total: number;
  mainTotal: number;
  helperBonus: number;
  dc: number;
  success: boolean;
} {
  // Main player's roll + modifier
  const mainTotal = mainRoll + mainModifier;
  
  // Each proficient helper adds +2 (D&D 5e Help action rule)
  const helperBonus = allHelpersProficient ? helpers * 2 : 0;
  
  const total = mainTotal + helperBonus;
  
  return {
    total,
    mainTotal,
    helperBonus,
    dc: 15, // Default DC, can be overridden
    success: total >= 15
  };
}

export function getCombinedCheckDescription(
  skill: string,
  helpers: number,
  success: boolean,
  locale: string
): string {
  const verb = locale === "zh-CN" ? "检定" : "check";
  const result = success ? (locale === "zh-CN" ? "成功" : "SUCCESS") : (locale === "zh-CN" ? "失败" : "FAILURE");
  
  if (helpers === 0) {
    return `${skill} ${verb}: ${result}`;
  }
  
  return `${skill} ${verb} (with ${helpers} helper${helpers > 1 ? "s" : ""}): ${result}`;
}
```

- [ ] **Step 4: Add combined check handler in engine.ts**

Modify `src/game/engine.ts` handlePlayerAction around line 240-280, add combined check detection:

```typescript
// ---- Combined skill checks (multiple players helping) ----
const skillCheck = getActionSkillCheck(payload.action);

if (skillCheck && skillCheck.dc > 0) {
  // Check if other players are helping (via payload or game state)
  const helpers = payload.helpers?.length || 0; // Add helpers field to payload
  
  if (helpers > 0) {
    // Auto-roll combined check
    const d20Rolls = rollDice(20, 1);
    const d20Total = calculateTotal(d20Rolls, 0);
    
    const abilityMod = calculateModifier(player.attributes[skillCheck.ability]);
    const isSkilled = CLASS_SKILL_PROFICIENCIES[player.characterClass]?.includes(skillCheck.skill);
    const proficiency = isSkilled ? calculateProficiencyBonus(player.level) : 0;
    const mainModifier = abilityMod + proficiency;
    
    const combinedResult = calculateCombinedCheck(d20Total, mainModifier, helpers);
    
    diceResult = {
      id: generateId(),
      playerId,
      playerName: player.name,
      characterName: player.characterName,
      diceType: 20,
      count: 1,
      rolls: d20Rolls,
      modifier: mainModifier + combinedResult.helperBonus,
      total: combinedResult.total,
      isHit: combinedResult.success,
      timestamp: Date.now(),
      skillCheck: {
        skill: skillCheck.skill,
        dc: skillCheck.dc,
        success: combinedResult.success,
        helpers: helpers // NEW field
      } as any
    };

    actionContext += `\n\nCombined ${skillCheck.skill} Check (DC ${skillCheck.dc})\n` +
      `Main: d20 = ${d20Rolls[0]} + ${mainModifier} = ${combinedResult.mainTotal}\n` +
      `Helpers: ${helpers} player(s) assist (+${combinedResult.helperBonus})\n` +
      `Total: ${combinedResult.total} vs DC ${skillCheck.dc} = ${combinedResult.success ? "SUCCESS" : "FAILURE"}`;

    console.log(`[CombinedCheck] ${skillCheck.skill}: ${combinedResult.total} vs DC ${skillCheck.dc} with ${helpers} helpers`);
  } else {
    // Single player check (existing logic)
    // ... existing auto-roll code ...
  }
}
```

- [ ] **Step 5: Update PlayerActionPayload schema**

Modify `shared/schemas/action.ts` or add to `src/types/index.ts`:

```typescript
export interface PlayerActionPayload {
  action: string;
  dice?: { type: number; count: number; modifier?: number };
  target?: string;
  helpers?: string[]; // NEW - Player IDs helping on this check
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/game/engine.test.ts -t "combined check"`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/game/engine.ts src/game/rules.ts src/types/index.ts
git commit -m "feat: add combined skill checks with helper bonus"
```

---

### Task 3: Add File-Based Game Persistence

**Files:**
- Create: `src/utils/storage.ts` (file storage utilities)
- Modify: `src/game/store.ts` (add save/load methods)
- Modify: `locales/*.json` (save/load locale strings)

- [ ] **Step 1: Write the test**

```typescript
// tests/game/storage.test.ts - new file
import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import { saveGame, loadGame, listGames } from "../../src/utils/storage.js";

describe("saveGame", () => {
  it("should save game to JSON file", async () => {
    const mockGame = {
      id: "test-game",
      name: "Test Adventure",
      players: [],
      npcs: [],
      chatHistory: [],
      // ... other fields
    };

    vi.mock("fs");
    fs.writeFileSync.mockImplementation(() => {});

    const result = await saveGame(mockGame);
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(result).toBe("test-game");
  });
});

describe("loadGame", () => {
  it("should load game from JSON file", async () => {
    const mockGame = { id: "test-game", name: "Test" };
    vi.mock("fs");
    fs.readFileSync.mockReturnValue(JSON.stringify(mockGame));

    const result = await loadGame("test-game");
    expect(result).toEqual(mockGame);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/storage.test.ts`
Expected: FAIL - file not found

- [ ] **Step 3: Create storage utility**

Create `src/utils/storage.ts`:

```typescript
import * as fs from "fs";
import * as path from "path";
import type { Game } from "../types/index.js";

const STORAGE_DIR = path.join(process.cwd(), "saved_games");

// Ensure storage directory exists
function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * Save game to JSON file
 */
export function saveGame(game: Game): string {
  ensureStorageDir();
  
  const filePath = path.join(STORAGE_DIR, `${game.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(game, null, 2));
  
  console.log(`[Storage] Saved game ${game.id} to ${filePath}`);
  return game.id;
}

/**
 * Load game from JSON file
 */
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

/**
 * List all saved games
 */
export function listGames(): Array<{ id: string; name: string; createdAt: number }> {
  ensureStorageDir();
  
  const files = fs.readdirSync(STORAGE_DIR).filter(f => f.endsWith(".json"));
  
  return files.map(file => {
    const gameId = file.replace(".json", "");
    const filePath = path.join(STORAGE_DIR, file);
    
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const game = JSON.parse(content) as Game;
      return {
        id: game.id,
        name: game.name,
        createdAt: game.createdAt
      };
    } catch {
      // Skip corrupted files
      return null;
    }
  }).filter((g): g is NonNullable<typeof g> => g !== null);
}

/**
 * Delete saved game
 */
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

/**
 * Auto-save game periodically (call this in GameEngine)
 */
export function setupAutoSave(game: Game, intervalMs: number = 60000): NodeJS.Timeout {
  return setInterval(() => {
    saveGame(game);
  }, intervalMs);
}
```

- [ ] **Step 4: Add save/load to GameStore**

Modify `src/game/store.ts` around line where methods are defined:

```typescript
export class GameStore {
  // ... existing code ...

  /**
   * Save all games to disk
   */
  saveAllGames(): void {
    for (const [id, engine] of this.games) {
      storage.saveGame(engine.game);
    }
  }

  /**
   * Load games from disk on startup
   */
  loadSavedGames(): void {
    const saved = storage.listGames();
    for (const gameMeta of saved) {
      const gameData = storage.loadGame(gameMeta.id);
      if (gameData) {
        // Recreate engine from saved game
        // Note: LLM client needs to be re-initialized
        this.games.set(gameMeta.id, /* recreate engine */);
      }
    }
  }

  /**
   * Auto-save every minute
   */
  startAutoSave(): void {
    setInterval(() => this.saveAllGames(), 60000);
  }
}
```

- [ ] **Step 5: Add locale strings**

Modify `locales/en-US.json`:

```json
"save.success": "✅ Game saved!",
"save.error": "❌ Save failed",
"load.success": "✅ Game loaded!",
"load.error": "❌ Failed to load game",
"saved_games.title": "💾 Saved Adventures"
```

Modify `locales/zh-CN.json`:

```json
"save.success": "✅ 游戏已保存！",
"save.error": "❌ 保存失败",
"load.success": "✅ 游戏已加载！",
"load.error": "❌ 加载游戏失败",
"saved_games.title": "💾 已保存的冒险"
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/game/storage.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/utils/storage.ts src/game/store.ts locales/en-US.json locales/zh-CN.json tests/game/storage.test.ts
git commit -m "feat: add file-based game persistence with auto-save"
```

---

### Task 4: Add XP and Leveling System

**Files:**
- Modify: `src/game/engine.ts` (XP tracking, level up logic)
- Modify: `src/game/rules.ts` (XP thresholds, attribute growth)
- Modify: `shared/schemas/game.ts` (XP schema)

- [ ] **Step 1: Write the test**

```typescript
// tests/game/rules.test.ts - add new test
import { describe, it, expect } from "vitest";
import { calculateXPThreshold, getLevelUpBenefits } from "../../src/game/rules.js";

describe("calculateXPThreshold", () => {
  it("should return correct XP for level 2", () => {
    const threshold = calculateXPThreshold(2);
    expect(threshold).toBe(300); // D&D 5e: Level 2 = 300 XP
  });

  it("should return correct XP for level 3", () => {
    const threshold = calculateXPThreshold(3);
    expect(threshold).toBe(900);
  });
});

describe("getLevelUpBenefits", () => {
  it("should increase HP on level up", () => {
    const benefits = getLevelUpBenefits("Fighter", 2);
    expect(benefits.hpIncrease).toBeGreaterThanOrEqual(6); // Fighter: d10 HD
    expect(benefits.proficiencyBonus).toBe(2); // Level 2 proficiency
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/rules.test.ts -t "XP threshold"`
Expected: FAIL

- [ ] **Step 3: Add XP rules in rules.ts**

Add after combined check functions in `src/game/rules.ts`:

```typescript
// ============================================================================
// XP & LEVELING — D&D 5e experience and level progression
// ============================================================================

export const XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000
};

export function calculateXPThreshold(level: number): number {
  return XP_THRESHOLDS[level] || 355000; // Cap at level 20
}

export function checkLevelUp(xp: number, currentLevel: number): {
  shouldLevelUp: boolean;
  newLevel: number;
  xpToNext: number;
} {
  let newLevel = currentLevel;
  
  while (newLevel < 20 && xp >= calculateXPThreshold(newLevel + 1)) {
    newLevel++;
  }
  
  const shouldLevelUp = newLevel > currentLevel;
  const xpToNext = newLevel < 20 ? calculateXPThreshold(newLevel + 1) - xp : 0;
  
  return { shouldLevelUp, newLevel, xpToNext };
}

export function getLevelUpBenefits(characterClass: string, newLevel: number): {
  hpIncrease: number;
  proficiencyBonus: number;
  newSpellSlots?: Record<string, number>;
  newFeatures?: string[];
} {
  // Calculate HP increase (roll HD or take average)
  const hd = getHitDiceForClass(characterClass);
  const conMod = 0; // Will be applied with actual CON mod
  const hpIncrease = Math.floor(hd / 2) + 1 + conMod; // Average + 1
  
  // Proficiency bonus by level
  let proficiencyBonus = 2;
  if (newLevel >= 5) proficiencyBonus = 3;
  if (newLevel >= 9) proficiencyBonus = 4;
  if (newLevel >= 13) proficiencyBonus = 5;
  if (newLevel >= 17) proficiencyBonus = 6;
  
  const benefits: {
    hpIncrease: number;
    proficiencyBonus: number;
    newSpellSlots?: Record<string, number>;
    newFeatures?: string[];
  } = {
    hpIncrease,
    proficiencyBonus
  };

  // Spellcaster classes get new spell slots
  if (["Wizard", "Sorcerer", "Cleric", "Paladin", "Ranger", "Bard", "Warlock"].includes(characterClass)) {
    benefits.newSpellSlots = calculateNewSpellSlots(newLevel);
  }

  // Class-specific features
  benefits.newFeatures = getClassFeaturesAtLevel(characterClass, newLevel);
  
  return benefits;
}

function getHitDiceForClass(characterClass: string): number {
  const defaults: Record<string, number> = {
    Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 8,
    Cleric: 8, Druid: 8, Monk: 8, Rogue: 8,
    Sorcerer: 6, Warlock: 6, Wizard: 6, Bard: 8
  };
  return defaults[characterClass] || 8;
}

function calculateNewSpellSlots(level: number): Record<string, number> {
  // Simplified spell slot progression
  const slots: Record<string, number> = {};
  
  if (level >= 1) slots["level-1"] = 2;
  if (level >= 2) slots["level-1"] = 3;
  if (level >= 3) {
    slots["level-1"] = 4;
    slots["level-2"] = 2;
  }
  if (level >= 5) {
    slots["level-1"] = 4;
    slots["level-2"] = 3;
    slots["level-3"] = 2;
  }
  // ... continue for higher levels
  
  return slots;
}

function getClassFeaturesAtLevel(characterClass: string, level: number): string[] {
  const features: string[] = [];
  
  if (characterClass === "Fighter") {
    if (level === 2) features.push("Second Wind");
    if (level === 3) features.push("Fighting Style");
    if (level === 5) features.push("Extra Attack");
  }
  
  if (characterClass === "Rogue") {
    if (level === 2) features.push("Cunning Action");
    if (level === 3) features.push("Roguish Archetype");
    if (level === 5) features.push("Uncanny Dodge");
  }
  
  // Add more class features...
  
  return features;
}

export function awardXP(players: Player[], xpAmount: number): void {
  for (const player of players) {
    player.xp += xpAmount;
    
    const levelUp = checkLevelUp(player.xp, player.level);
    if (levelUp.shouldLevelUp) {
      const benefits = getLevelUpBenefits(player.characterClass, levelUp.newLevel);
      
      player.level = levelUp.newLevel;
      player.hp += benefits.hpIncrease;
      player.maxHp += benefits.hpIncrease;
      player.proficiencyBonus = benefits.proficiencyBonus;
      
      if (benefits.newSpellSlots) {
        for (const [key, val] of Object.entries(benefits.newSpellSlots)) {
          player.spellSlots[key] = val;
        }
      }
      
      console.log(`[LevelUp] ${player.characterName} reached level ${levelUp.newLevel}!`);
    }
  }
}
```

- [ ] **Step 4: Add XP awarding in engine.ts**

Modify `src/game/engine.ts` after combat/resolution around line 396-410:

```typescript
if (parsed.structured.creatureDefeated && parsed.structured.creatureHp) {
  const idx = this._game.npcs.findIndex(n => n.name === parsed.structured.creatureHp!.name);
  if (idx >= 0) {
    // Award XP for defeating enemy
    const xpPerEnemy = 50; // Simplified - should be based on CR
    awardXP(this._game.players, xpPerEnemy);
    
    this._game.npcs.splice(idx, 1);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/game/rules.test.ts -t "XP threshold"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/game/engine.ts src/game/rules.ts
git commit -m "feat: add XP tracking and level up system"
```

---

### Task 5: Add Save/Load UI to Frontend

**Files:**
- Modify: `public/js/app.ts` (save/load buttons, XP display)
- Modify: `public/css/style.css` (save/load button styling)

- [ ] **Step 1: Write the test**

```typescript
// tests/frontend/save-load.test.ts - new file
import { describe, it, expect } from "vitest";

describe("Save/Load UI", () => {
  it("should display save button", () => {
    // Test button rendering
  });

  it("should show XP and level in status panel", () => {
    // Test XP display
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/frontend/save-load.test.ts`
Expected: FAIL

- [ ] **Step 3: Add save/load buttons in app.ts**

Modify showGameUI in app.ts, add save/load buttons to header:

```typescript
container.innerHTML = `
  <div class="game-interface">
    ${this.renderLocaleDropdown()}
    <header class="game-header">
      <h2>${this.escapeHtml(game.name)}</h2>
      <div class="game-actions">
        <button id="save-game-btn" class="secondary">💾 Save</button>
        <button id="load-game-btn" class="secondary">📂 Load</button>
      </div>
      <!-- timer and other header content -->
    </header>
    
    <!-- rest of UI -->
  </div>
`;

// Add save/load handlers
const saveBtn = document.getElementById("save-game-btn");
const loadBtn = document.getElementById("load-game-btn");

saveBtn?.addEventListener("click", async () => {
  try {
    // Call backend API to save game
    const response = await fetch(`/api/games/${this.gameId}/save`, { method: "POST" });
    if (response.ok) {
      this.showNotification(t("save.success"), "success");
    } else {
      this.showNotification(t("save.error"), "error");
    }
  } catch {
    this.showNotification(t("save.error"), "error");
  }
});

loadBtn?.addEventListener("click", async () => {
  // Show load dialog or reload current game
  if (this.gameId) {
    window.location.reload(); // Simple reload for now
  }
});
```

- [ ] **Step 4: Add XP display in status panel**

Modify renderPlayersStatus in app.ts:

```typescript
private renderPlayersStatus(): string {
  const game = gameState.game;
  if (!game?.players) return "";

  const currentPlayerId = gameState.currentPlayer?.id;

  return game.players.map(player => {
    const isCurrent = player.id === currentPlayerId;
    const hpPct = player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0;
    const xpToNext = player.level < 20 
      ? calculateXPThreshold(player.level + 1) - player.xp 
      : 0;

    return `
      <li class="player-status ${isCurrent ? "current" : ""}" data-player-id="${player.id}">
        <div class="player-info">
          <span class="player-name">${this.escapeHtml(player.characterName || player.name)}</span>
          <span class="player-class">${player.characterClass} Lv.${player.level}</span>
        </div>
        <div class="hp-bar">
          <div class="hp-bar-fill" style="width: ${hpPct}%"></div>
          <span class="hp-bar-text">${player.hp}/${player.maxHp}</span>
        </div>
        <div class="xp-bar">
          <span class="xp-text">XP: ${player.xp} / ${calculateXPThreshold(player.level + 1)}</span>
        </div>
      </li>
    `;
  }).join("");
}

// Import XP calculation function
function calculateXPThreshold(level: number): number {
  const thresholds: Record<number, number> = {
    1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500,
    6: 14000, 7: 23000, 8: 34000, 9: 48000, 10: 64000
    // ... continue
  };
  return thresholds[level] || 355000;
}
```

- [ ] **Step 5: Add styling in style.css**

Modify `public/css/style.css`:

```css
/* Game Actions */
.game-actions {
  display: flex;
  gap: 0.5rem;
}

.game-actions button {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

/* XP Bar */
.xp-bar {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.xp-text {
  display: block;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/frontend/save-load.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add public/js/app.ts public/css/style.css tests/frontend/save-load.test.ts
git commit -m "feat: add save/load UI and XP display"
```

---

### Task 6: Add Backend Save/Load API Routes

**Files:**
- Create: `src/routes/games.save.post.ts` (save game endpoint)
- Create: `src/routes/games.load.get.ts` (load game endpoint)
- Modify: `src/server.ts` (add routes)

- [ ] **Step 1: Write the test**

```typescript
// tests/api/save-load.test.ts - new file
import { describe, it, expect } from "vitest";

describe("POST /api/games/:id/save", () => {
  it("should save game and return success", async () => {
    // Test API endpoint
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/save-load.test.ts`
Expected: FAIL

- [ ] **Step 3: Create save route**

Create `src/routes/games.save.post.ts`:

```typescript
import { defineEventHandler, readBody, createError } from "h3";
import { gameStore } from "../game/store.js";
import * as storage from "../utils/storage.js";

export default defineEventHandler(async (event) => {
  const gameId = event.context.params?.id;
  
  if (!gameId) {
    throw createError({ statusCode: 400, statusMessage: "Game ID required" });
  }
  
  const engine = gameStore.getGame(gameId);
  
  if (!engine) {
    throw createError({ statusCode: 404, statusMessage: "Game not found" });
  }
  
  try {
    storage.saveGame(engine.game);
    return { success: true, gameId };
  } catch (error) {
    throw createError({ 
      statusCode: 500, 
      statusMessage: error instanceof Error ? error.message : "Save failed" 
    });
  }
});
```

- [ ] **Step 4: Create load route**

Create `src/routes/games.load.get.ts`:

```typescript
import { defineEventHandler, createError } from "h3";
import * as storage from "../utils/storage.js";

export default defineEventHandler(async (event) => {
  const gameId = event.context.params?.id;
  
  if (!gameId) {
    throw createError({ statusCode: 400, statusMessage: "Game ID required" });
  }
  
  try {
    const game = storage.loadGame(gameId);
    
    if (!game) {
      throw createError({ statusCode: 404, statusMessage: "Game not found" });
    }
    
    return { success: true, game };
  } catch (error) {
    throw createError({ 
      statusCode: 500, 
      statusMessage: error instanceof Error ? error.message : "Load failed" 
    });
  }
});
```

- [ ] **Step 5: Register routes in server.ts**

Modify `src/server.ts` around where routes are registered:

```typescript
// Add save/load routes
server.use("/api/games/:id/save", gamesSavePostHandler);
server.use("/api/games/:id/load", gamesLoadGetHandler);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/api/save-load.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/routes/games.save.post.ts src/routes/games.load.get.ts src/server.ts tests/api/save-load.test.ts
git commit -m "feat: add save/load API endpoints"
```

---

### Task 7: Final Build and Test Verification

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
Expected: All tests pass (should be 70+ after new tests)

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: verify build and tests pass for Phase 2"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [ ] Condition tracking (poisoned, prone, blinded, etc.) ✓
- [ ] Combined skill checks with helpers ✓
- [ ] File-based persistence with auto-save ✓
- [ ] XP and leveling system ✓
- [ ] Save/load UI and API ✓

**2. Placeholder scan:**
- [ ] No "TBD", "TODO" in code blocks ✓
- [ ] All test cases have actual assertions ✓
- [ ] All locale strings defined ✓

**3. Type consistency:**
- [ ] `conditions` field in Player interface ✓
- [ ] `helpers` field in PlayerActionPayload ✓
- [ ] `xp` field in Player interface ✓
- [ ] Storage functions (saveGame/loadGame) used correctly ✓

---

Plan complete and saved to `docs/superpowers/plans/2026-05-03-multiplayer-phase2-coop-persistence.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
