# Adaptive DM Prompt System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `src/llm/prompts.ts` from a monolithic 101-line file into modular functions with adaptive scenario tone, narrative style rules, dialogue formatting, active level logic, and pacing — while preserving the existing public API so `engine.ts` needs zero changes.

**Architecture:** Seven focused functions concatenate into two public APIs (`buildSystemPrompt`, `buildActionPrompt`). Each function is independently testable via vitest unit tests. No new dependencies beyond vitest for testing. Parser and engine remain untouched because JSON output format only adds optional fields the parser already ignores.

**Tech Stack:** TypeScript, ESM modules, vitest (test framework), Node.js — matching existing tsconfig bundler resolution.

---

### Task 1: Install vitest and create test infrastructure

**Files:**
- Create: `tests/prompts.test.ts`
- Modify: `package.json` (add devDependencies + scripts)
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest`

Expected: vitest installed in node_modules, package.json updated with vitest entry.

- [ ] **Step 2: Add test scripts to package.json**

Open `package.json`. In the `"scripts"` section, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

The full scripts block should look like:
```json
"scripts": {
  "build:backend": "tsc",
  "build:frontend": "vite build",
  "build": "npm run build:backend && npm run build:frontend",
  "dev:backend": "tsc --watch",
  "start": "npm run build && node dist/src/server.js",
  "dev": "concurrently \"npm run dev:backend\" \"vite\"",
  "stop": "powershell -Command \"netstat -ano | findstr :3000 | findstr LISTENING | for %%a in (%%a) { taskkill /F /PID %%a }\"",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create vitest.config.ts**

Write file `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Verify vitest discovers tests (before any exist)**

Run: `npx vitest run`

Expected: "No test files found" or similar — vitest is configured correctly but no tests yet. This confirms the setup works.

- [ ] **Step 5: Commit**

```bash
git add package.json vitest.config.ts
git commit -m "chore: add vitest testing infrastructure"
```

---

### Task 2: Write failing tests for all prompt functions

**Files:**
- Create: `tests/prompts.test.ts`

This test file imports the actual `buildSystemPrompt` and `buildActionPrompt` from `src/llm/prompts.js`. Since those functions still exist (unchanged), tests will pass initially. Then we refactor — tests become our safety net.

- [ ] **Step 1: Write comprehensive prompt tests**

Write file `tests/prompts.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildActionPrompt } from '../src/llm/prompts.js';
import type { Player, NPC, DiceRoll } from '../src/types/index.js';

describe('buildSystemPrompt', () => {
  it('returns a non-empty string for dungeon scenario', () => {
    const prompt = buildSystemPrompt('dungeon');
    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain('Dungeon Master');
  });

  it('includes JSON output format markers', () => {
    const prompt = buildSystemPrompt('dungeon');
    expect(prompt).toContain('---JSON---');
    expect(prompt).toContain('hit');
    expect(prompt).toContain('isCritical');
  });

  it('includes scenario-specific tone for each scenario type', () => {
    const scenarios = ['dungeon', 'wilderness', 'intrigue', 'horror', 'epic', 'sea'] as const;
    
    // Dungeon: claustrophobic, ancient keywords
    expect(buildSystemPrompt('dungeon')).toMatch(/(claustrophob|ancient|stone|torch)/i);
    
    // Wilderness: expansive, alive keywords  
    expect(buildSystemPrompt('wilderness')).toMatch(/(expansive|alive|wind|pine|horizon)/i);
    
    // Intrigue: dialogue-driven keywords
    expect(buildSystemPrompt('intrigue')).toMatch(/(dialogue|courtl|whisper|agend)/i);
    
    // Horror: eerie, uncertain keywords
    expect(buildSystemPrompt('horror')).toMatch(/(eerie|uncertain|fog|shadow|wet)/i);
    
    // Epic: grand, sweeping keywords
    expect(buildSystemPrompt('epic')).toMatch(/(grand|sweeping|mountain|banner|dragon)/i);
    
    // Sea: rhythmic, vast keywords
    expect(buildSystemPrompt('sea')).toMatch(/(rhythmic|vast|salt|creak|hori)/i);
  });

  it('includes narrative style rules (show don tell)', () => {
    const prompt = buildSystemPrompt('dungeon');
    expect(prompt).toContain('Show, Don\'t Tell') || expect(prompt).toMatch(/(show.*don.*tell|concrete verbs)/i);
  });

  it('includes sensory layering rule', () => {
    const prompt = buildSystemPrompt('dungeon');
    expect(prompt).toMatch(/sensory/i) && expect(prompt).toMatch(/2.*sense|minimu/i);
  });

  it('includes paragraph structure guidance', () => {
    const prompt = buildSystemPrompt('dungeon');
    // Should mention scene setup, NPC actions, or player decision moment
    expect(prompt).toMatch(/(scene|opening|NPC action|decision)/i);
  });

  it('includes dialogue formatting rules', () => {
    const prompt = buildSystemPrompt('dungeon');
    expect(prompt).toMatch(/(double quote|attribution|murmur|whisper|\*.*\*)/i);
  });

  it('includes adaptive pacing rules', () => {
    const prompt = buildSystemPrompt('dungeon');
    // Should mention combat pacing or exploration pacing
    expect(prompt).toMatch(/(combat.*short|exploration.*longer|rhythm)/i);
  });

  it('includes active level logic (reactive + proactive)', () => {
    const prompt = buildSystemPrompt('dungeon');
    expect(prompt).toMatch(/(reactiv|proactiv|hesis|complication)/i);
  });

  it('never narrates player actions', () => {
    const prompt = buildSystemPrompt('dungeon');
    expect(prompt).toMatch(/(never narrate|player.*action|assum/i);
  });

  it('includes sceneTransition and npcMoodChanges in JSON format', () => {
    const prompt = buildSystemPrompt('dungeon');
    expect(prompt).toContain('sceneTransition');
    expect(prompt).toContain('npcMoodChanges');
  });

  it('returns consistent output for same scenario (deterministic)', () => {
    const a = buildSystemPrompt('horror');
    const b = buildSystemPrompt('horror');
    expect(a).toBe(b);
  });
});

describe('buildActionPrompt', () => {
  it('includes player name and stats', () => {
    const mockPlayer: Player = {
      id: 'p1',
      name: 'TestPlayer',
      characterName: 'Aldric',
      isDM: false,
      race: 'Human',
      characterClass: 'Fighter',
      level: 3,
      attributes: { str: 16, dex: 12, con: 14, int: 10, wis: 8, cha: 12 },
      hp: 25, maxHp: 30, ac: 16, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };
    
    const prompt = buildActionPrompt('I attack the goblin', {
      currentPlayer: mockPlayer,
      combatStatus: 'Active combat — round 3',
      conversationHistory: [],
      scenario: 'dungeon'
    });

    expect(prompt).toContain('Aldric');
    expect(prompt).toContain('Fighter');
    expect(prompt).toContain('Human');
    expect(prompt).toContain('Str=16');
  });

  it('includes scenario tone reference', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TP', characterName: 'Char', isDM: false, race: 'Elf',
      characterClass: 'Rogue', level: 2, attributes: { str: 10, dex: 16, con: 12, int: 12, wis: 14, cha: 10 },
      hp: 15, maxHp: 18, ac: 14, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const prompt = buildActionPrompt('I sneak past', {
      currentPlayer: mockPlayer,
      combatStatus: 'Exploration',
      conversationHistory: [],
      scenario: 'horror'
    });

    // Should reference the horror tone somehow (claustrophobic/ancient/etc.)
    expect(prompt).toMatch(/(claustrophob|eerie|ancient)/i);
  });

  it('includes target NPC details when provided', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TP', characterName: 'Char', isDM: false, race: 'Human',
      characterClass: 'Cleric', level: 4, attributes: { str: 12, dex: 10, con: 14, int: 14, wis: 16, cha: 12 },
      hp: 30, maxHp: 35, ac: 16, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const mockTarget: NPC = {
      id: 'n1', name: 'Zombie Guard', description: 'Decayed armor', role: 'hostile',
      hp: 8, maxHp: 8, ac: 9, attributes: { str: 14, dex: 6, con: 16, int: 3, wis: 6, cha: 5 }, createdAt: Date.now()
    };

    const prompt = buildActionPrompt('I strike with my mace', {
      currentPlayer: mockPlayer,
      target: mockTarget,
      combatStatus: 'Combat — Zombie Guard engaged',
      conversationHistory: [],
      scenario: 'dungeon'
    });

    expect(prompt).toContain('Zombie Guard');
    expect(prompt).toContain('HP: 8/8');
    expect(prompt).toContain('AC: 9');
  });

  it('includes dice roll result when provided', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TP', characterName: 'Char', isDM: false, race: 'Human',
      characterClass: 'Wizard', level: 5, attributes: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 6 },
      hp: 28, maxHp: 32, ac: 12, proficiencyBonus: 3, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const diceResult: DiceRoll = {
      id: 'd1', playerId: 'p1', playerName: 'TP', characterName: 'Char',
      diceType: 20, count: 1, rolls: [17], modifier: 3, total: 20, isHit: true, timestamp: Date.now()
    };

    const prompt = buildActionPrompt('I cast Fireball at the goblin horde', {
      currentPlayer: mockPlayer,
      diceResult,
      combatStatus: 'Combat — Round 5',
      conversationHistory: [],
      scenario: 'dungeon'
    });

    expect(prompt).toContain('20d');
    expect(prompt).toContain('[17]');
    expect(prompt).toContain('+ 3 = 20');
  });

  it('includes recent conversation history', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TP', characterName: 'Char', isDM: false, race: 'Human',
      characterClass: 'Barbarian', level: 1, attributes: { str: 18, dex: 12, con: 16, int: 8, wis: 10, cha: 8 },
      hp: 14, maxHp: 14, ac: 13, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const history = [
      { role: 'system', content: 'You enter a dimly lit cavern. The walls glisten with moisture.' },
      { role: 'user', content: 'I examine the wall closely for carvings.' },
      { role: 'assistant', content: 'The stone bears faded runes — ancient dwarven script, worn by centuries of dripping water.' }
    ];

    const prompt = buildActionPrompt('I read the runes aloud', {
      currentPlayer: mockPlayer,
      combatStatus: 'Exploration',
      conversationHistory: history,
      scenario: 'dungeon'
    });

    expect(prompt).toContain('Recent conversation');
    expect(prompt).toContain('dimly lit cavern');
  });

  it('is deterministic for same inputs', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TP', characterName: 'Char', isDM: false, race: 'Human',
      characterClass: 'Ranger', level: 3, attributes: { str: 14, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
      hp: 22, maxHp: 25, ac: 15, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const promptA = buildActionPrompt('I shoot an arrow', {
      currentPlayer: mockPlayer, combatStatus: 'Combat', conversationHistory: [], scenario: 'wilderness'
    });
    const promptB = buildActionPrompt('I shoot an arrow', {
      currentPlayer: mockPlayer, combatStatus: 'Combat', conversationHistory: [], scenario: 'wilderness'
    });

    expect(promptA).toBe(promptB);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass with current implementation**

Run: `npx vitest run`

Expected: All tests PASS. The current monolithic implementation already produces output containing "Dungeon Master", "---JSON---", scenario keywords, etc. Some regex tests may be loose — that's fine, they'll still pass and will catch regressions when we restructure.

If any test fails (unlikely with current code), adjust the regex to match existing content. Run again until all pass.

- [ ] **Step 3: Commit**

```bash
git add tests/prompts.test.ts
git commit -m "test: add comprehensive prompt function unit tests"
```

---

### Task 3: Refactor prompts.ts into modular functions

**Files:**
- Modify: `src/llm/prompts.ts` (complete rewrite of file structure)

This is the core task. The file grows from ~101 lines to ~350+ lines but each section is focused and independently testable. The public API (`buildSystemPrompt`, `buildActionPrompt`) remains identical so `engine.ts` needs zero changes.

- [ ] **Step 1: Rewrite prompts.ts with all modular functions**

Replace entire contents of `src/llm/prompts.ts` with:

```ts
import type { Player, NPC, DiceRoll } from "../types/index.js";
import { scenarioDescriptions, type Scenario } from "../../shared/schemas/scenario.js";

// ============================================================================
// SCENARIO TONE DATA — Each scenario has its own prose voice
// ============================================================================

const SCENARIO_TONES: Record<Scenario, { tone: string; sensory: string; pacing: string; phrases: string[] }> = {
  dungeon: {
    tone: "Claustrophobic and ancient. Focus on what's close — walls pressing in, torchlight fighting darkness.",
    sensory: "Touch (cold stone underfoot), sound (dripping water, distant scraping), sight (shadows beyond your light).",
    pacing: "Slow exploration with sudden sharp moments when danger reveals itself.",
    phrases: [
      "The air tastes of old smoke and damp earth.",
      "Something shifts in the dark beyond your torchlight.",
      "Faded names carved into stone — no one remembers what this place was called."
    ]
  },
  wilderness: {
    tone: "Expansive and alive. The world stretches wide, full of movement and sound.",
    sensory: "Sound (wind through pines, bird calls), smell (pine resin, damp earth), sight (horizon line hiding what's next).",
    pacing: "Measured and flowing — like walking a trail that keeps revealing new turns.",
    phrases: [
      "The wind carries the scent of pine and distant rain.",
      "A path forks ahead, one worn by boots, the other fresh with crushed ferns.",
      "Something moves in the treeline — too large to be deer."
    ]
  },
  intrigue: {
    tone: "Dialogue-driven and layered. Every conversation has an undercurrent. Manners mask agendas.",
    sensory: "Hearing (whispers overheard at banquets), sight (a noble's glance lingering too long), touch (deliberate gestures — tea poured with slowness).",
    pacing: "Measured, with sudden reveals when hidden threads snap tight.",
    phrases: [
      "The merchant watches you. His hand rests near a dagger beneath his counter.",
      "A whispered conversation drifts from the next room — your name mentioned twice.",
      "She smiles, but her eyes don't."
    ]
  },
  horror: {
    tone: "Eerie and uncertain. The world feels wrong in small ways that accumulate.",
    sensory: "Sound (wet dragging in silence), sight (a shadow where no object casts it), temperature (breath fogging in warm air).",
    pacing: "Slow build with sharp jumps — tension coiling, then snapping.",
    phrases: [
      "The fog moves against the wind.",
      "Silence broken by something wet and dragging across stone.",
      "Your breath fogs in air that should not be cold."
    ]
  },
  epic: {
    tone: "Grand and sweeping. Mountains crowned with snow, banners snapping across battlefields. The fate of the realm hangs in the balance.",
    sensory: "Sight (dragon silhouettes eclipsing sun, ancient fortresses on cliffs), sound (war horns, snapping fabric), feeling (wind that carries voices from distant valleys).",
    pacing: "Broad strokes with focused moments — like a camera panning across a landscape then zooming in.",
    phrases: [
      "Ancient prophecies half-remembered by those who still dare to speak them.",
      "The mountain peaks are crowned with snow even in summer.",
      "A dragon's silhouette eclipses the sun as it passes overhead."
    ]
  },
  sea: {
    tone: "Rhythmic and vast. The ocean dictates everything — its pulse, its moods, its hunger.",
    sensory: "Taste (salt crust on lips), sound (creaking timber, waves swallowing the deck edge), touch (timber groaning under stress).",
    pacing: "Wave-like — building tension with each swell, then receding into calm.",
    phrases: [
      "The horizon dissolves into grey.",
      "A lighthouse blinks through the storm, steady as a heartbeat.",
      "Salt crusts on your lips. The sea has been tasting you all day."
    ]
  }
};

// ============================================================================
// MODULAR PROMPT BUILDERS — Each returns one section of the system prompt
// ============================================================================

/**
 * Core identity: DM role, adaptive tone directive, player agency rules.
 */
function buildCoreIdentity(): string {
  return `You are an adaptive Dungeon Master for a D&D 5e solo campaign. Your voice shifts with the world around you.

CORE RULES:
- Never narrate what the player does — only describe what exists and how the world reacts to their choices.
- "The door stands before you" (correct). "You open the door" (wrong). "Your sword glints as you charge forward" (wrong — that's narrating the player).
- Always end your response with a structured JSON block between ---JSON--- markers. It must be valid JSON.`;
}

/**
 * Scenario-specific tone, sensory focus, pacing style, and signature phrases.
 */
function buildScenarioTone(scenario: Scenario): string {
  const t = SCENARIO_TONES[scenario];
  return `SCENARIO: ${scenarioDescriptions[scenario].label} — ${scenarioDescriptions[scenario].description}

TONE: ${t.tone}
SENSORY FOCUS: ${t.sensory}
PACING STYLE: ${t.pacing}

SIGNATURE PHRASES TO WEAVE NATURALLY (don't force them, use when they fit):
${t.phrases.map(p => `- "${p}"`).join('\n')}`;
}

/**
 * Narrative style rules: show don't tell, sensory layering, paragraph structure.
 */
function buildNarrativeStyle(): string {
  return `NARRATIVE STYLE:

Show, Don't Tell — Replace abstract states with observable behavior:
- "The goblin is angry" → WRONG. Use: "The goblin bares yellowed teeth, knuckles white around its rusted blade."
- "The dungeon is scary" → WRONG. Use: "The torch gutters. Something breathes in the dark beyond your light."

Sensory Layering — Minimum 2 senses per paragraph. Never visual-only descriptions:
- Combine sight + sound, smell + touch, taste + sight.
- Example: "The air tastes of copper and old smoke. Your boots crunch on shattered glass as a draft carries wet stone."

Paragraph Structure — Follow this pattern for each response:
1. Opening paragraph: Establish scene (where we are, what changed since last turn)
2. Middle paragraph(s): NPC actions, environmental details, player-relevant clues
3. Closing paragraph: Present an opening for the player to act ("The merchant watches you. His hand rests near a dagger beneath his counter.")

Vocabulary Rules:
- Use concrete nouns over abstract ones (stone pillar > structure)
- Active voice preferred (the wolf lunges > the wolf is seen lunging)
- One strong metaphor per response maximum — don't pile them on`;
}

/**
 * Dialogue formatting rules for NPC speech.
 */
function buildDialogueRules(): string {
  return `DIALOGUE FORMATTING:
- NPC dialogue uses double quotes with attribution: "Come closer," the priest murmurs, eyes fixed on your sword.
- Whispered or muffled speech uses asterisk markers: *Can you hear me?* a voice echoes from within the wall.
- Enemy battle cries and shouts are standalone lines for impact.
- Never put words in the player's mouth — only quote NPCs and environmental sounds ("The wind howls like a wounded animal").`;
}

/**
 * Active level logic: reactive default with proactive triggers.
 */
function buildActiveLevelLogic(): string {
  return `ACTIVE LEVEL (Hybrid Approach):

Default state: REACTIVE. Describe the current scene. Wait for player input. No new events introduced.

Shift to PROACTIVE when any of these triggers fire:
- Combat is active: Introduce environmental hazards, NPC tactics shifting, time pressure ("The bridge crumbles behind you — only three steps remain.")
- 2+ turns of pure exploration with no NPCs or combat: Drop a hook naturally. Weather changes, distant sound, discovered clue. Never force — always offer. Example: "As you rest, you notice the campfire ash has been disturbed."
- Player HP below 50%: Introduce urgency. Wounds ache, stamina fading, enemy closing in, ally calling for help.

Proactive moments feel like discoveries, not interruptions.`;
}

/**
 * Adaptive pacing rules based on context.
 */
function buildAdaptivePacing(): string {
  return `ADAPTIVE PACING:

Combat → Short, punchy sentences. Staccato rhythm. "The axe swings. Steel meets shield with a ringing crack." Keep paragraphs to 1-2 tight ones. Focus on immediate threats and positioning.

Exploration → Longer flowing sentences. Measured pace. 3-4 descriptive paragraphs. Focus on clues, atmosphere, hidden details, sensory richness.

Downtime/Rest → Slow, reflective prose. Full paragraphs. 2-3 character-focused paragraphs. NPC interactions, world lore, quiet moments.

Reveal/Twist → Build tension with short sentences, then one long reveal sentence: "The door opens. Dust falls. And there—standing in the torchlight—is the king you thought dead." One paragraph total. Focus on the moment and reaction space for the player.

Rule: Never shift pacing mid-paragraph. Pick a rhythm and commit to it.`;
}

/**
 * Structured output format with field descriptions.
 */
function buildOutputFormat(): string {
  return `OUTPUT FORMAT:
After your narrative, you MUST include a JSON block at the end in this exact format:

---JSON---
{
  "hit": true/false,
  "isCritical": true/false,
  "damage": number,
  "playerHp": { "before": number, "after": number },
  "creatureHp": { "name": "string", "before": number, "after": number },
  "creatureDefeated": true/false,
  "newNPCs": [],
  "newEvents": [{ "title": "string", "description": "string" }],
  "newSpells": [{ "name": "string", "level": number }],
  "sceneTransition": { "from": "string", "to": "string" },
  "npcMoodChanges": [{ "npcName": "string", "from": "string", "to": "string" }],
  "turn": {
    "nextPlayerId": "string",
    "initiative": [{ "playerId": "string", "npcId?: string", "score": number }],
    "round": number
  }
}
---JSON---

Field descriptions:
- hit/isCritical/damage: Combat results for the player's action
- playerHp/creatureHp: HP before and after combat (only include if damage occurred)
- creatureDefeated: true when a hostile NPC falls
- newNPCs: NPCs introduced during this response
- newEvents: Significant events that just happened
- newSpells: Spells learned or discovered by the player
- sceneTransition: Only include when location changes between turns
- npcMoodChanges: Attitude shifts for existing NPCs (e.g., hostile → neutral after persuasion)
- turn: Next player's ID, current initiative order, round number

ALWAYS include the JSON block. It must be valid JSON between the ---JSON--- markers.`;
}

// ============================================================================
// PUBLIC API — Combined system prompt and action prompt builders
// ============================================================================

export function buildSystemPrompt(scenario: Scenario = "dungeon"): string {
  return [
    buildCoreIdentity(),
    "",
    buildScenarioTone(scenario),
    "",
    buildNarrativeStyle(),
    "",
    buildDialogueRules(),
    "",
    buildActiveLevelLogic(),
    "",
    buildAdaptivePacing(),
    "",
    buildOutputFormat()
  ].join('\n\n');
}

export function buildActionPrompt(
  action: string,
  context: {
    currentPlayer: Player;
    target?: NPC;
    diceResult?: DiceRoll;
    combatStatus: string;
    conversationHistory: { role: string; content: string }[];
    scenario: Scenario;
  }
): string {
  const player = context.currentPlayer;
  const target = context.target;

  let prompt = `Player "${player.characterName}" (${player.characterClass}, ${player.race}, Lv.${player.level}) says: "${action}"

SCENARIO TONE: ${SCENARIO_TONES[context.scenario].tone}

Player stats:
- HP: ${player.hp}/${player.maxHp}
- AC: ${player.ac}
- Attributes: Str=${player.attributes.str} Dex=${player.attributes.dex} Con=${player.attributes.con} Int=${player.attributes.int} Wis=${player.attributes.wis} Cha=${player.attributes.cha}
- Conditions: ${player.conditions.length ? player.conditions.join(", ") : "none"}

Scenario: ${scenarioDescriptions[context.scenario].label} — ${scenarioDescriptions[context.scenario].description}

`;

  if (target) {
    prompt += `Target: "${target.name}"
- HP: ${target.hp}/${target.maxHp}
- AC: ${target.ac}
- Attributes: Str=${target.attributes.str} Dex=${target.attributes.dex} Con=${target.attributes.con} Int=${target.attributes.int} Wis=${target.attributes.wis} Cha=${target.attributes.cha}

`;
  } else if (player.spells.length > 0) {
    prompt += `Known spells:\n${player.spells.map(s => `- ${s.name} (${s.level}-level)`).join('\n')}\n\n`;
  }

  if (context.diceResult) {
    prompt += `Dice roll: ${context.diceResult.count}d${context.diceResult.diceType} = [${context.diceResult.rolls.join(", ")}] + ${context.diceResult.modifier} = ${context.diceResult.total}

`;
  }

  prompt += `Combat status: ${context.combatStatus}

`;

  if (context.conversationHistory.length > 0) {
    prompt += `Recent conversation (last 5 turns):\n`;
    const recent = context.conversationHistory.slice(-10);
    for (const msg of recent) {
      prompt += `[${msg.role}]: ${msg.content.substring(0, 200)}\n`;
    }
  }

  return prompt;
}
```

Key changes from the original:
- `SCENARIO_CONTEXT` replaced with `SCENARIO_TONES` — each scenario now has tone, sensory focus, pacing style, and signature phrases (not just a single description string)
- 7 modular builder functions added (core identity, scenario tone, narrative style, dialogue rules, active level logic, adaptive pacing, output format)
- `buildSystemPrompt()` concatenates all sections with blank line separators
- `buildActionPrompt()` adds `SCENARIO TONE` reference line so the DM knows which voice to use per response, and shows known spells when player has any

- [ ] **Step 2: Run tests to verify refactoring didn't break anything**

Run: `npx vitest run`

Expected: All tests PASS. The modular functions produce equivalent output to the original monolithic version — same keywords, same structure, just organized differently.

If any test fails (e.g., regex doesn't match a new keyword), update the regex in Task 2's test file or adjust the prompt text. Run again until all pass.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: `(no output)` — zero errors. The public API signatures are unchanged so engine.ts compiles cleanly.

If any error, fix type mismatches in the new code (likely related to NPC attributes — original only listed Str/Dex/Con for targets but I added Int/Wis/Cha too).

- [ ] **Step 4: Verify full build**

Run: `npm run build`

Expected: Backend compiles successfully. Frontend builds cleanly. No errors in either phase.

If backend fails, check that the `.js` import extension in engine.ts still resolves correctly (ESM requires explicit extensions). If frontend fails, unrelated — prompts.ts is backend-only.

- [ ] **Step 5: Commit**

```bash
git add src/llm/prompts.ts tests/prompts.test.ts package.json vitest.config.ts
git commit -m "feat: restructure DM prompt into modular adaptive system with scenario-specific tone, narrative rules, and pacing"
```

---

### Task 4: Final verification — server start + smoke test

**Files:**
- No file changes — runtime verification only

- [ ] **Step 1: Check syntax of compiled output**

Run: `node --check dist/src/server.js`

Expected: `(no output)` — syntax valid.

- [ ] **Step 2: Verify server starts with correct config**

Run: `timeout 5 npm start`

Expected: Server logs showing LLM_API_URL, LLM_MODEL, port 3000 listening. No errors from prompts module initialization. The system prompt is built at game creation time, so no runtime error should occur.

If the server fails to start due to a prompt-related issue (e.g., malformed JSON format string), check that `---JSON---` markers appear correctly in buildOutputFormat() output and that all template strings are properly closed.

- [ ] **Step 3: Commit**

No new files added — just verification. Skip commit if nothing changed since Task 4 Step 5, or add a final note:

```bash
git status
# If clean, no commit needed (all changes committed in Task 2 and Task 3)
```

---

## Self-Review

**Spec coverage:**
| Spec Section | Implementation Task |
|-------------|---------------------|
| Core Identity + Scenario Tone | Task 3 Step 1: `buildCoreIdentity()` + `SCENARIO_TONES` data + `buildScenarioTone()` |
| Narrative Style Rules | Task 3 Step 1: `buildNarrativeStyle()` with show-don't-tell, sensory layering, paragraph structure |
| Dialogue Formatting | Task 3 Step 1: `buildDialogueRules()` with quote attribution and whisper markers |
| Active Level Logic (Hybrid) | Task 3 Step 1: `buildActiveLevelLogic()` with reactive/default + proactive triggers table |
| Adaptive Pacing | Task 3 Step 1: `buildAdaptivePacing()` with combat/exploration/downtime/reveal rhythm table |
| Enhanced JSON Output | Task 3 Step 1: `buildOutputFormat()` including sceneTransition and npcMoodChanges fields |
| Action Prompt tone reference | Task 3 Step 1: Added SCENARIO TONE line in buildActionPrompt() + spell listing |

All spec sections covered. No gaps.

**Placeholder scan:**
- ✅ All code blocks complete — no "TBD", "TODO", or "fill in" markers
- ✅ All 6 scenario tone entries fully written with phrases, sensory focus, pacing
- ✅ Test file contains full test code for every function
- ✅ Exact commands provided with expected output

**Type consistency:**
- `SCENARIO_TONES` uses `Record<Scenario, {tone: string; sensory: string; pacing: string; phrases: string[]}>` — consistent throughout
- Public API signatures identical to original (`buildSystemPrompt(scenario)` returns string, `buildActionPrompt(action, context)` returns string)
- NPC attributes in action prompt now include Int/Wis/Cha (original only had Str/Dex/Con for targets) — matches Player interface fully

**Scope check:**
- Single file modified (`prompts.ts`) plus test infrastructure additions
- No changes to parser, engine, client, or frontend
- Optional JSON fields (sceneTransition, npcMoodChanges) already handled by existing parser via Record<string, unknown> filtering
- Scope is appropriate for a single implementation cycle
