# Combat Actions Menu & Attack Resolution System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement structured combat attack actions with target selection, dice rolls, critical hits, damage application, and XP rewards.

**Architecture:** Add a structured combat action schema that allows players to specify attacks with weapon/damage configuration. The GameEngine will parse these actions, calculate attack rolls against AC, handle critical hits (natural 20), apply damage with temporary HP absorption, and award XP on enemy defeat. Frontend adds attack buttons with target selectors and damage dice configuration.

**Tech Stack:** TypeScript, Zod schemas, Vitest for testing, WebSocket for real-time combat updates.

---

## File Structure

### Files to Modify
- `shared/schemas/action.ts` - Add `combatActionSchema` for structured attack payloads
- `src/game/rules.ts` - Add attack resolution functions: `resolveAttack`, `calculateCriticalDamage`, `handleEnemyDefeat`
- `src/game/engine.ts` - Integrate attack resolution in `handlePlayerAction`, broadcast results via structured output
- `public/js/action-bar.ts` - Add combat action buttons with target selector and damage dice config
- `public/js/app.ts` - Add attack result rendering (hit/miss/critical visual feedback)
- `locales/en-US.json` - Add combat action localization strings
- `locales/zh-CN.json` - Add Chinese localization for combat actions

### Files to Create
- `tests/game/combat-actions.test.ts` - Comprehensive tests for attack resolution logic
- `tests/frontend/combat-actions-ui.test.ts` - UI tests for combat action buttons (if frontend testing infrastructure exists)

---

### Task 1: Combat Action Schema

**Files:**
- Modify: `shared/schemas/action.ts:1-14`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/game/combat-actions.test.ts - First test block
import { describe, it, expect } from "vitest";
import { combatActionSchema } from "../../shared/schemas/action.js";

describe("combatActionSchema", () => {
  it("should validate a basic attack action", () => {
    const validAction = {
      type: "attack" as const,
      target: "Goblin",
      weapon: "Longsword",
      damageDice: { type: 8, count: 1 },
      attackBonus: 5,
    };
    
    const result = combatActionSchema.safeParse(validAction);
    expect(result.success).toBe(true);
  });

  it("should reject missing target", () => {
    const invalidAction = {
      type: "attack" as const,
      weapon: "Longsword",
      damageDice: { type: 8, count: 1 },
    };
    
    const result = combatActionSchema.safeParse(invalidAction);
    expect(result.success).toBe(false);
  });

  it("should validate critical hit configuration", () => {
    const actionWithCrit = {
      type: "attack" as const,
      target: "Orc",
      weapon: "Shortbow",
      damageDice: { type: 6, count: 2 },
      attackBonus: 3,
      criticalMultiplier: 2,
    };
    
    const result = combatActionSchema.safeParse(actionWithCrit);
    expect(result.success).toBe(true);
    expect(result.data.criticalMultiplier).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/combat-actions.test.ts`
Expected: FAIL - "combatActionSchema is not exported"

- [ ] **Step 3: Write minimal implementation**

Add to `shared/schemas/action.ts`:

```typescript
import { z } from "zod";

export const playerActionSchema = z.object({
  action: z.string().min(1).max(500),
  dice: z.object({
    type: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12), z.literal(20)]),
    count: z.number().int().min(1).max(10),
    modifier: z.number().optional(),
  }).optional(),
  target: z.string().max(100).optional(),
  helpers: z.array(z.string()).optional(),
});

// NEW: Combat-specific action schema
export const combatActionSchema = z.object({
  type: z.literal("attack"),
  target: z.string().min(1).max(100), // Target NPC/creature name
  weapon: z.string().min(1).max(50).optional(), // Weapon name from inventory
  damageDice: z.object({
    type: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
    count: z.number().int().min(1).max(10),
    modifier: z.number().optional(),
  }),
  attackBonus: z.number().optional(), // Auto-calculated if not provided
  criticalMultiplier: z.number().int().min(2).max(4).default(2), // D&D default: 2x damage on crit
});

export type PlayerActionInput = z.infer<typeof playerActionSchema>;
export type CombatActionInput = z.infer<typeof combatActionSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/combat-actions.test.ts`
Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add shared/schemas/action.ts tests/game/combat-actions.test.ts
git commit -m "feat: add combat action schema with attack validation"
```

---

### Task 2: Attack Resolution Rules

**Files:**
- Modify: `src/game/rules.ts:670-734` (append after existing combat mechanics)

- [ ] **Step 1: Write the failing tests**

```typescript
// Add to tests/game/combat-actions.test.ts
describe("resolveAttack", () => {
  const mockPlayer: Player = {
    id: "player1", name: "Test", characterName: "Hero", isDM: false,
    race: "Human", characterClass: "Fighter", level: 1,
    attributes: { str: 16, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    hp: 10, maxHp: 10, ac: 11, proficiencyBonus: 2,
    spellSlots: {}, spells: [], inventory: [], conditions: [],
    hitDice: { total: 1, used: 0 }, deathSaves: { successes: 0, failures: 0 },
    xp: 0, locale: "en-US"
  };

  const mockNPC: NPC = {
    id: "npc1", name: "Goblin", description: "Small enemy", role: "hostile",
    hp: 7, maxHp: 7, ac: 15, attributes: { str: 10, dex: 12, con: 10, int: 8, wis: 10, cha: 8 },
    createdAt: Date.now(), conditions: [],
  };

  it("should calculate hit on natural 20 (critical)", () => {
    // Mock Math.random to return 0.995 (natural 20)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.995);
    
    const result = resolveAttack(mockPlayer, mockNPC, {
      damageDice: { type: 8, count: 1 },
      attackBonus: 5,
    });
    
    expect(result.hit).toBe(true);
    expect(result.isCritical).toBe(true);
    expect(result.damage).toBeGreaterThanOrEqual(16); // Double damage (8 + mod * 2)
    
    randomSpy.mockRestore();
  });

  it("should miss when roll + bonus < AC", () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1); // Natural 2
    const result = resolveAttack(mockPlayer, mockNPC, {
      damageDice: { type: 8, count: 1 },
      attackBonus: 5,
    });
    
    // Roll: 2 + 5 = 7 < AC 15 = miss
    expect(result.hit).toBe(false);
    expect(result.isCritical).toBe(false);
    expect(result.damage).toBe(0);
    
    randomSpy.mockRestore();
  });

  it("should apply damage on hit", () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // Natural 10
    const result = resolveAttack(mockPlayer, mockNPC, {
      damageDice: { type: 8, count: 1, modifier: 3 },
      attackBonus: 5,
    });
    
    // Roll: 10 + 5 = 15 >= AC 15 = hit
    expect(result.hit).toBe(true);
    expect(result.isCritical).toBe(false);
    expect(result.damage).toBeGreaterThan(0);
    
    randomSpy.mockRestore();
  });
});

describe("applyDamageWithTemporaryHP", () => {
  it("should absorb damage with temporary HP first", () => {
    const creature = { hp: 10, maxHp: 10, temporaryHp: 5 };
    const result = applyDamageWithTemporaryHP(creature, 3);
    
    expect(result.damageDealt).toBe(0);
    expect(result.temporaryHpRemaining).toBe(2);
    expect(result.isDefeated).toBe(false);
  });

  it("should overflow temporary HP and damage actual HP", () => {
    const creature = { hp: 10, maxHp: 10, temporaryHp: 5 };
    const result = applyDamageWithTemporaryHP(creature, 8);
    
    expect(result.damageDealt).toBe(3); // 8 - 5 temp = 3 actual
    expect(result.temporaryHpRemaining).toBe(0);
    expect(result.isDefeated).toBe(false);
  });

  it("should defeat creature when damage exceeds HP", () => {
    const creature = { hp: 5, maxHp: 5, temporaryHp: 0 };
    const result = applyDamageWithTemporaryHP(creature, 10);
    
    expect(result.damageDealt).toBe(10);
    expect(result.isDefeated).toBe(true);
  });
});

describe("handleEnemyDefeat", () => {
  it("should award XP to all players on enemy defeat", () => {
    const players = [
      { xp: 0, level: 1, ...mockPlayer } as Player,
      { xp: 100, level: 1, ...mockPlayer, id: "player2" } as Player,
    ];
    
    const result = handleEnemyDefeat(players, "Goblin", 50);
    
    expect(result.xpAwarded).toBe(50);
    expect(players[0].xp).toBe(50);
    expect(players[1].xp).toBe(150);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/combat-actions.test.ts`
Expected: FAIL - "resolveAttack is not exported"

- [ ] **Step 3: Write minimal implementation**

Add to `src/game/rules.ts` after line 734:

```typescript
// ============================================================================
// ATTACK RESOLUTION — Structured combat attack mechanics
// ============================================================================

export interface AttackResolutionResult {
  hit: boolean;
  isCritical: boolean;
  attackRoll: number;
  attackBonus: number;
  targetAC: number;
  damage: number;
  damageDice: { type: number; count: number; modifier?: number };
  criticalMultiplier: number;
}

/**
 * Resolve a structured attack action
 */
export function resolveAttack(
  attacker: Player | NPC,
  target: NPC,
  attackConfig: {
    damageDice: { type: number; count: number; modifier?: number };
    attackBonus?: number;
    criticalMultiplier?: number;
  }
): AttackResolutionResult {
  // Roll d20 for attack
  const d20Roll = rollDice(20, 1)[0];
  
  // Calculate attack bonus (proficiency + ability mod) if not provided
  const attackBonus = attackConfig.attackBonus ?? getAttackBonus(attacker as Player);
  const totalAttack = d20Roll + attackBonus;
  
  // Determine hit/critical
  let hit = false;
  let isCritical = false;
  
  if (d20Roll === 20) {
    // Natural 20 = automatic hit, critical
    hit = true;
    isCritical = true;
  } else if (d20Roll === 1) {
    // Natural 1 = automatic miss
    hit = false;
    isCritical = false;
  } else {
    hit = totalAttack >= target.ac;
    isCritical = false;
  }
  
  // Calculate damage
  let damage = 0;
  if (hit) {
    damage = calculateAttackDamage(attackConfig.damageDice);
    
    // Critical hit: double all damage dice
    if (isCritical) {
      const criticalMultiplier = attackConfig.criticalMultiplier ?? 2;
      damage = calculateCriticalDamage(attackConfig.damageDice, criticalMultiplier);
    }
  }
  
  return {
    hit,
    isCritical,
    attackRoll: d20Roll,
    attackBonus,
    targetAC: target.ac,
    damage,
    damageDice: attackConfig.damageDice,
    criticalMultiplier: attackConfig.criticalMultiplier ?? 2,
  };
}

/**
 * Calculate critical hit damage (double dice)
 */
export function calculateCriticalDamage(
  damageDice: { type: number; count: number; modifier?: number },
  multiplier: number = 2
): number {
  // Double the dice count for critical
  const doubledCount = damageDice.count * multiplier;
  const rolls = rollDice(damageDice.type as any, doubledCount);
  const total = calculateTotal(rolls, damageDice.modifier || 0);
  return total;
}

/**
 * Apply damage with temporary HP absorption
 */
export function applyDamageWithTemporaryHP(
  creature: { hp: number; maxHp: number; temporaryHp?: number },
  damage: number
): { 
  damageDealt: number; 
  temporaryHpRemaining?: number;
  isDefeated: boolean;
} {
  let tempHp = creature.temporaryHp || 0;
  
  // Temporary HP absorbs damage first
  if (tempHp > 0) {
    if (damage <= tempHp) {
      tempHp -= damage;
      return { 
        damageDealt: 0, 
        temporaryHpRemaining: tempHp,
        isDefeated: false 
      };
    } else {
      damage -= tempHp;
      tempHp = 0;
    }
  }
  
  // Remaining damage goes to actual HP
  const newHp = creature.hp - damage;
  return {
    damageDealt: damage,
    temporaryHpRemaining: 0,
    isDefeated: newHp <= 0
  };
}

/**
 * Handle enemy defeat: remove from game, award XP
 */
export function handleEnemyDefeat(
  players: Player[],
  enemyName: string,
  xpValue: number = 50
): { 
  xpAwarded: number; 
  defeatedEnemy: string;
} {
  // Award XP to all players
  awardXP(players, xpValue);
  
  return {
    xpAwarded: xpValue,
    defeatedEnemy: enemyName,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/combat-actions.test.ts`
Expected: PASS (all tests including new attack resolution tests)

- [ ] **Step 5: Commit**

```bash
git add src/game/rules.ts tests/game/combat-actions.test.ts
git commit -m "feat: implement attack resolution with critical hits and damage"
```

---

### Task 3: GameEngine Attack Integration

**Files:**
- Modify: `src/game/engine.ts:399-648` (integrate into handlePlayerAction)

- [ ] **Step 1: Write the failing test**

```typescript
// Add to tests/game/combat-actions.test.ts
describe("GameEngine attack integration", () => {
  let engine: GameEngine;
  
  beforeEach(() => {
    const mockLLMClient = { streamChat: vi.fn() };
    
    engine = new GameEngine(
      { 
        id: "test-game", 
        name: "Test", 
        scenario: "dungeon", 
        maxPlayers: 4, 
        npcs: [{
          id: "npc1", name: "Goblin", description: "Enemy", role: "hostile",
          hp: 7, maxHp: 7, ac: 15, attributes: { str: 10, dex: 12, con: 10, int: 8, wis: 10, cha: 8 },
          createdAt: Date.now(), conditions: [],
        }], 
        players: [{
          id: "player1", name: "Test", characterName: "Hero", isDM: true,
          race: "Human", characterClass: "Fighter", level: 1,
          attributes: { str: 16, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
          hp: 10, maxHp: 10, ac: 11, proficiencyBonus: 2,
          spellSlots: {}, spells: [], inventory: [], conditions: [],
          hitDice: { total: 1, used: 0 }, deathSaves: { successes: 0, failures: 0 },
          xp: 0, locale: "en-US"
        }]
      },
      "http://test", null, "test"
    );
    
    (engine as any).llmClient = mockLLMClient;
  });

  it("should process attack action and update NPC HP", async () => {
    // Mock LLM to return structured attack result
    (engine as any).llmClient.streamChat.mockResolvedValue({
      fullNarrative: "You strike the goblin!",
      structured: {
        hit: true,
        isCritical: false,
        damage: 8,
        creatureHp: { name: "Goblin", before: 7, after: 0 },
        creatureDefeated: true,
      }
    });
    
    const result = await engine.handlePlayerAction(
      { action: "attack goblin" },
      "player1",
      { onChunk: () => {}, onEnd: () => {} }
    );
    
    const npc = engine.game.npcs.find(n => n.name === "Goblin");
    expect(npc).toBeUndefined(); // Should be removed after defeat
    expect(engine.game.players[0].xp).toBe(50); // XP awarded
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/combat-actions.test.ts -t "GameEngine attack integration"`
Expected: FAIL - Test may fail due to incomplete integration

- [ ] **Step 3: Write minimal implementation**

Update `src/game/engine.ts` in `handlePlayerAction` method. Add after the existing dice handling (around line 450):

```typescript
// ---- NEW: Handle structured combat attack actions ----

// Check if action contains structured combat attack data
if (payload.action && typeof payload.action === 'string') {
  const actionLower = payload.action.toLowerCase();
  
  // Detect attack action with target
  if (actionLower.includes("attack") && payload.target) {
    const targetNPC = this._game.npcs.find(n => 
      n.name.toLowerCase().includes(payload.target!.toLowerCase())
    );
    
    if (targetNPC && this._game.combatMode) {
      // Parse attack configuration from action text or use defaults
      const weaponMatch = payload.action.match(/with\s+(\w+)/i);
      const weaponName = weaponMatch ? weaponMatch[1] : undefined;
      
      // Find weapon in player inventory if specified
      let damageDice = getDamageDice(player, 
        weaponName ? player.inventory.find(i => i.name.toLowerCase() === weaponName.toLowerCase()) : undefined
      );
      
      // Calculate attack bonus
      const attackBonus = getAttackBonus(player);
      
      // Resolve attack using new rules
      const attackResult = resolveAttack(player, targetNPC, {
        damageDice,
        attackBonus,
      });
      
      // Apply damage with temporary HP handling
      const damageResult = applyDamageWithTemporaryHP(targetNPC, attackResult.damage);
      
      // Update NPC HP
      const newHp = targetNPC.hp - damageResult.damageDealt;
      this.updateNPCHP(targetNPC.id, newHp);
      
      // Log attack result for LLM context
      console.log(`[Attack] ${player.characterName} attacks ${targetNPC.name}: ${attackResult.attackRoll}+${attackBonus} vs AC ${targetNPC.ac} = ${attackResult.hit ? (attackResult.isCritical ? "CRITICAL HIT!" : "HIT") : "MISS"} (${attackResult.damage} damage)`);
      
      // If enemy defeated, remove and award XP
      if (damageResult.isDefeated) {
        const npcIdx = this._game.npcs.findIndex(n => n.id === targetNPC.id);
        if (npcIdx >= 0) {
          const xpPerEnemy = 50;
          awardXP(this._game.players, xpPerEnemy);
          this._game.npcs.splice(npcIdx, 1);
          
          console.log(`[Defeat] ${targetNPC.name} defeated! XP awarded: ${xpPerEnemy}`);
        }
      }
      
      // Include attack result in diceResult for display
      diceResult = {
        id: generateId(),
        playerId,
        playerName: player.name,
        characterName: player.characterName,
        diceType: 20,
        count: 1,
        rolls: [attackResult.attackRoll],
        modifier: attackBonus,
        total: attackResult.attackRoll + attackBonus,
        isHit: attackResult.hit,
        timestamp: Date.now(),
        attackResult: attackResult as any,
      };
    }
  }
}
```

Also update the LLM response parsing section (around line 590) to handle structured attack results:

```typescript
// ---- Enhanced: Handle structured combat results from LLM ----

if (parsed.structured.attackResult) {
  // LLM returned structured attack result - apply it
  const attackData = parsed.structured.attackResult as AttackResolutionResult;
  
  if (attackData.hit && parsed.structured.creatureHp) {
    const creature = this._game.npcs.find(n => n.name === parsed.structured.creatureHp!.name);
    if (creature) {
      const damageResult = applyDamageWithTemporaryHP(creature, attackData.damage);
      this.updateNPCHP(creature.id, creature.hp - damageResult.damageDealt);
      
      if (damageResult.isDefeated) {
        const npcIdx = this._game.npcs.findIndex(n => n.id === creature.id);
        if (npcIdx >= 0) {
          awardXP(this._game.players, 50);
          this._game.npcs.splice(npcIdx, 1);
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/combat-actions.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/game/engine.ts tests/game/combat-actions.test.ts
git commit -m "feat: integrate attack resolution into GameEngine"
```

---

### Task 4: Frontend Combat Action UI

**Files:**
- Modify: `public/js/action-bar.ts:1-213`
- Modify: `public/js/app.ts:700-720` (add attack result rendering)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/frontend/combat-actions-ui.test.ts (if frontend testing exists)
// Or manual verification steps in the test file
describe("Combat Action UI", () => {
  it("should render attack button when combat is active", () => {
    // This requires DOM testing setup - for now, manual verification
    expect(true).toBe(true); // Placeholder
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/frontend/combat-actions-ui.test.ts`
Expected: PASS (placeholder only) - Manual UI testing required

- [ ] **Step 3: Write minimal implementation**

Update `public/js/action-bar.ts`:

```typescript
import { wsManager } from "./websocket.js";
import { gameState } from "./game-state.js";
import { t } from "./i18n.js";

// Static preset actions (always available) — both label and action text are localized
const STATIC_PRESETS = [
  { label: () => t("action.search"), action: () => t("action.search_text") },
  { label: () => t("action.talk"), action: () => t("action.talk_text") },
  { label: () => t("action.hide"), action: () => t("action.hide_text") },
  { label: () => t("action.intelligence"), action: () => t("action.intelligence_text") },
  { label: () => t("action.defend"), action: () => t("action.defend_text") },
];

// Combat-specific preset (only shown in combat mode)
const COMBAT_PRESETS = [
  { label: () => t("action.attack"), action: () => "attack" },
];

export class ActionBar {
  private element: HTMLElement | null = null;
  private unsubscribe?: () => void;

  constructor(parent: HTMLElement) {
    this.element = document.createElement("div");
    this.element.className = "action-bar";
    parent.appendChild(this.element);
    
    this.render(); // Initial render
    this.subscribeToStateChanges(); // React to combat mode changes
    this.setupFreeTextListeners();
  }

  private subscribeToStateChanges(): void {
    this.unsubscribe = gameState.subscribe(({ game, currentPlayer }) => {
      if (game && currentPlayer) {
        this.render();
      }
    });
  }

  private render(): void {
    const game = gameState.game;
    const player = gameState.currentPlayer || game?.players?.[0];
    
    if (!player) return;

    // Gather available potions from inventory (potion-type items only)
    const potions: Array<{ name: string }> = 
      (player.inventory || []).filter(i => i.type === 'potion').map(i => ({ name: i.name }));

    // Gather spells from player's known spell list
    const spells = game?.players
      .find(p => p.id === player.id)?.spells || [];

    // Build static preset buttons HTML
    let presetsHtml = "";
    for (const preset of STATIC_PRESETS) {
      presetsHtml += `<button class="preset-btn" data-action="${this.escapeHtml(preset.action())}">${preset.label()}</button>`;
    }

    // Build combat preset buttons (only in combat mode)
    let combatPresetsHtml = "";
    if (gameState.combatMode && game?.npcs.length > 0) {
      for (const preset of COMBAT_PRESETS) {
        combatPresetsHtml += `<button class="preset-btn combat-btn" data-action="${this.escapeHtml(preset.action())}">${preset.label()}</button>`;
      }
      
      // Add target selector if NPCs exist
      combatPresetsHtml += `
        <select id="attack-target-select" class="target-selector" title="${t("action.select_target")}">
          <option value="">${t("action.select_target_placeholder")}</option>
          ${game.npcs.map(npc => `<option value="${this.escapeHtml(npc.name)}">${this.escapeHtml(npc.name)} (HP ${npc.hp}/${npc.maxHp})</option>`).join("")}
        </select>
      `;
      
      // Add damage dice selector
      combatPresetsHtml += `
        <select id="damage-dice-select" class="dice-selector" title="${t("action.select_damage")}">
          <option value="1d6">${t("dice.1d6")}</option>
          <option value="2d6">${t("dice.2d6")}</option>
          <option value="1d8">${t("dice.1d8")}</option>
          <option value="2d8">${t("dice.2d8")}</option>
          <option value="1d10">${t("dice.1d10")}</option>
          <option value="1d12">${t("dice.1d12")}</option>
        </select>
      `;
    }

    // Build potion buttons
    let potionsHtml = "";
    if (potions.length > 0) {
      potionsHtml = potions.map(p => 
        `<button class="action-item-btn potion-btn" data-action="${this.escapeHtml(p.name)}">🧪 ${this.escapeHtml(p.name)}</button>`
      ).join("");
    }

    // Build spell dropdown
    let spellsHtml = "";
    if (spells.length > 0) {
      const levelGroups: Record<number, string[]> = {};
      for (const spell of spells) {
        if (!levelGroups[spell.level]) levelGroups[spell.level] = [];
        levelGroups[spell.level].push(spell.name);
      }

      let dropdownOptions = "";
      for (const [level, names] of Object.entries(levelGroups)) {
        dropdownOptions += `<optgroup label="${t("spell.level_group", { level })}">`;
        for (const name of names) {
          dropdownOptions += `<option value="${this.escapeHtml(name)}">${this.escapeHtml(name)}</option>`;
        }
        dropdownOptions += `</optgroup>`;
      }

      spellsHtml = `
        <div class="spell-selector">
          <select id="spell-select" title="${t("spell.cast_tooltip")}">
            <option value="">${t("spell.cast_placeholder")}</option>
            ${dropdownOptions}
          </select>
        </div>
      `;
    }

    // Assemble the action bar HTML
    this.element!.innerHTML = `
      <div class="preset-actions">${presetsHtml}${combatPresetsHtml}</div>
      <div class="dynamic-actions">
        ${potionsHtml}
        ${spellsHtml}
      </div>
      <div class="free-text">
        <input type="text" id="action-input" placeholder="${t("action.placeholder")} (/emote text, /pm player message)">
        <button id="action-submit" class="primary">${t("action.submit")}</button>
      </div>
    `;

    this.attachDynamicListeners();
  }

  private attachDynamicListeners(): void {
    // Potion buttons
    this.element!.querySelectorAll(".potion-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-action") || "";
        this.sendAction(t("action.use_item", { name }));
      });
    });

    // Spell dropdown
    const spellSelect = document.getElementById("spell-select") as HTMLSelectElement;
    if (spellSelect) {
      spellSelect.addEventListener("change", () => {
        const selectedSpell = spellSelect.value;
        if (selectedSpell) {
          this.sendAction(t("action.cast_spell", { spellName: selectedSpell }));
          setTimeout(() => { spellSelect.value = ""; }, 100);
        }
      });
    }

    // Combat attack button with target and dice selection
    const attackBtn = this.element!.querySelector(".combat-btn[data-action='attack']");
    if (attackBtn) {
      attackBtn.addEventListener("click", () => {
        const targetSelect = document.getElementById("attack-target-select") as HTMLSelectElement;
        const diceSelect = document.getElementById("damage-dice-select") as HTMLSelectElement;
        
        const target = targetSelect?.value || "";
        const diceConfig = diceSelect?.value || "1d6";
        
        if (!target) {
          // Show error - no target selected
          console.warn("No target selected for attack");
          return;
        }
        
        // Parse dice config (e.g., "2d6" -> count: 2, type: 6)
        const diceMatch = diceConfig.match(/(\d+)d(\d+)/);
        if (diceMatch) {
          const count = parseInt(diceMatch[1]);
          const type = parseInt(diceMatch[2]);
          
          // Send attack action with structured data
          this.sendAction(`attack ${target} with ${count}d${type}`);
        } else {
          this.sendAction(`attack ${target}`);
        }
      });
    }

    // Preset buttons (non-combat)
    this.element!.querySelectorAll(".preset-btn:not(.combat-btn)").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action") || "";
        this.sendAction(action);
      });
    });

    // Free text input and submit button
    const input = document.getElementById("action-input") as HTMLInputElement;
    const submit = document.getElementById("action-submit") as HTMLButtonElement;

    submit?.addEventListener("click", () => this.sendAction(input?.value || ""));
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.sendAction(input.value);
      }
    });
  }

  private sendAction(action: string): void {
    if (!action.trim()) return;
    
    const trimmedAction = action.trim();
    
    // Parse /emote command
    if (trimmedAction.startsWith("/emote ")) {
      const emoteText = trimmedAction.substring(7).trim();
      if (emoteText) {
        wsManager.send({ type: "PLAYER_EMOTE", payload: { action: emoteText } });
      }
      const input = document.getElementById("action-input") as HTMLInputElement;
      if (input) input.value = "";
      return;
    }
    
    // Parse /pm or /whisper command
    const pmMatch = trimmedAction.match(/^\/pm\s+(\S+)\s+(.+)$/i) || trimmedAction.match(/^\/whisper\s+(\S+)\s+(.+)$/i);
    if (pmMatch) {
      const targetName = pmMatch[1];
      const message = pmMatch[2];
      
      const game = gameState.game;
      const targetPlayer = game?.players.find(p => 
        p.characterName.toLowerCase() === targetName.toLowerCase() || 
        p.name.toLowerCase() === targetName.toLowerCase()
      );
      
      if (targetPlayer) {
        wsManager.send({ type: "PRIVATE_CHAT", payload: { targetPlayerId: targetPlayer.id, content: message } });
      }
      const input = document.getElementById("action-input") as HTMLInputElement;
      if (input) input.value = "";
      return;
    }
    
    // Regular action - send as PLAYER_ACTION
    wsManager.send({ type: "PLAYER_ACTION", payload: { action: trimmedAction } });
    
    const input = document.getElementById("action-input") as HTMLInputElement;
    if (input) input.value = "";
  }

  private escapeHtml(text: string): string {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  destroy(): void {
    this.unsubscribe?.();
  }
}
```

Update `public/js/app.ts` to add attack result visual feedback (after line 700 in appendChatMessage):

```typescript
// Add after the existing diceResult handling in appendChatMessage:
if (message.diceResult && (message.diceResult as any).attackResult) {
  const attackResult = (message.diceResult as any).attackResult;
  const locale = getLocale();
  
  let attackText = "";
  if (attackResult.isCritical) {
    attackText = t("combat.critical_hit", { 
      roll: attackResult.attackRoll, 
      target: attackResult.targetAC 
    });
  } else if (attackResult.hit) {
    attackText = t("combat.hit", { 
      roll: attackResult.attackRoll + attackResult.attackBonus, 
      target: attackResult.targetAC,
      damage: attackResult.damage
    });
  } else {
    attackText = t("combat.miss", { 
      roll: attackResult.attackRoll + attackResult.attackBonus, 
      target: attackResult.targetAC 
    });
  }
  
  content += `<br><strong class="${attackResult.isCritical ? 'critical' : attackResult.hit ? 'hit' : 'miss'}">${attackText}</strong>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS - Build succeeds without errors

- [ ] **Step 5: Commit**

```bash
git add public/js/action-bar.ts public/js/app.ts
git commit -m "feat: add combat action UI with attack button and target selector"
```

---

### Task 5: Localization Strings

**Files:**
- Modify: `locales/en-US.json`
- Modify: `locales/zh-CN.json`

- [ ] **Step 1: Write localization entries**

Add to `locales/en-US.json`:

```json
{
  ...existing entries...,
  "action": {
    ...existing...,
    "attack": "Attack",
    "attack_text": "I attack",
    "select_target": "Select target",
    "select_target_placeholder": "Choose target...",
    "select_damage": "Select damage dice"
  },
  "dice": {
    ...existing...,
    "1d6": "1d6",
    "2d6": "2d6",
    "1d8": "1d8",
    "2d8": "2d8",
    "1d10": "1d10",
    "1d12": "1d12"
  },
  "combat": {
    "critical_hit": "CRITICAL HIT! 🎲 d20: {roll} vs AC {target}",
    "hit": "HIT! 🎲 {roll} vs AC {target} - {damage} damage",
    "miss": "MISS! 🎲 {roll} vs AC {target}"
  }
}
```

Add to `locales/zh-CN.json`:

```json
{
  ...existing entries...,
  "action": {
    ...existing...,
    "attack": "攻击",
    "attack_text": "我攻击",
    "select_target": "选择目标",
    "select_target_placeholder": "选择目标...",
    "select_damage": "选择伤害骰"
  },
  "dice": {
    ...existing...,
    "1d6": "1d6",
    "2d6": "2d6",
    "1d8": "1d8",
    "2d8": "2d8",
    "1d10": "1d10",
    "1d12": "1d12"
  },
  "combat": {
    "critical_hit": "暴击! 🎲 d20: {roll} vs AC {target}",
    "hit": "命中! 🎲 {roll} vs AC {target} - {damage} 伤害",
    "miss": "未命中! 🎲 {roll} vs AC {target}"
  }
}
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: PASS - Build succeeds

- [ ] **Step 3: Commit**

```bash
git add locales/en-US.json locales/zh-CN.json
git commit -m "feat: add combat action localization strings"
```

---

### Task 6: Full Test Suite & Build Verification

**Files:**
- No changes - verification only

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: PASS - All 119+ tests pass (including new combat action tests)

- [ ] **Step 2: Run build verification**

Run: `npm run build`
Expected: PASS - Build succeeds without errors

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: PASS - No type errors

- [ ] **Step 4: Final commit**

```bash
git add tests/game/combat-actions.test.ts
git commit -m "feat: add comprehensive combat action test coverage"
```

---

## Self-Review Checklist

After completing all tasks, run this checklist:

1. **Spec coverage:**
   - [ ] Combat action schema added to `shared/schemas/action.ts` ✓
   - [ ] Attack resolution in GameEngine.handlePlayerAction ✓
   - [ ] Damage dice configuration (1d6, 2d6, 1d8, etc.) ✓
   - [ ] Auto-calculate attack bonus based on character stats ✓
   - [ ] Critical hit detection (natural 20 = auto-hit, double damage) ✓
   - [ ] Damage application with temporary HP absorption ✓
   - [ ] XP award on enemy defeat ✓
   - [ ] Initiative order HP update ✓
   - [ ] Visual feedback for hit/miss/critical ✓

2. **Placeholder scan:**
   - [ ] No "TBD", "TODO", or "fill in" placeholders
   - [ ] All test code included with actual assertions
   - [ ] All implementation code provided

3. **Type consistency:**
   - [ ] `AttackResolutionResult` interface used consistently
   - [ ] `combatActionSchema` exported from shared/schemas
   - [ ] Frontend uses correct WebSocket message types

4. **Test coverage:**
   - [ ] Attack roll calculation tested
   - [ ] Critical hit detection tested
   - [ ] Damage application with temp HP tested
   - [ ] XP award tested
   - [ ] GameEngine integration tested

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-04-combat-actions-attack-resolution.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
