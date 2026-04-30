# Adaptive DM Prompt System — Design Spec

**Date:** 2026-04-29  
**File:** `src/llm/prompts.ts` (restructured)  
**Goal:** Replace monolithic system prompt with modular, scenario-adaptive storytelling engine that shifts tone, pacing, and narrative voice based on context.

---

## 1. Architecture Changes

### Current State
Single function `buildSystemPrompt()` returns one concatenated string (~47 lines). Scenario context is a lookup table. Action prompt appends player stats + conversation history. No narrative style rules, no dialogue formatting, no pacing logic.

### Target State
`prompts.ts` restructured into focused functions, each returning a section of the system prompt:

| Function | Responsibility | Returns |
|----------|---------------|---------|
| `buildCoreIdentity()` | DM role, adaptive tone directive, player agency rules | String section (~30 lines) |
| `buildScenarioTone(scenario)` | Scenario-specific prose voice + atmosphere keywords | String section (~90 lines total across 6 scenarios) |
| `buildNarrativeStyle()` | Show-don't-tell, sensory layering, paragraph structure | String section (~40 lines) |
| `buildDialogueRules()` | NPC speech formatting, whisper markers, attribution | String section (~25 lines) |
| `buildActiveLevelLogic()` | Reactive/proactive switching rules | String section (~35 lines) |
| `buildAdaptivePacing()` | Combat/exploration/downtime/reveal rhythm rules | String section (~30 lines) |
| `buildOutputFormat()` | JSON block template + field descriptions | String section (~45 lines) |

`buildSystemPrompt(scenario)` becomes a simple concatenation of all sections above.  
`buildActionPrompt()` remains structurally similar but adds scenario tone reference.

### Why This Structure
- Each function is independently testable (pass scenario, verify output contains expected keywords)
- Adding a new scenario only requires updating `buildScenarioTone()` switch block — no touching narrative rules
- Parser compatibility maintained: JSON format unchanged except optional new fields (`sceneTransition`, `npcMoodChanges`) which parser already ignores as unknown properties

---

## 2. Core Identity (Section 1)

Shared across all scenarios. Defines DM's fundamental behavior:

**Content:**
- Adaptive Dungeon Master role for D&D 5e solo campaign
- Voice shifts with the world — tone is scenario-dependent
- Never narrate player actions (only describe what exists and how world reacts)
- Always end responses with structured JSON between `---JSON---` markers
- Player agency: present situations, never assume choices

**Example output section:**
```
You are an adaptive Dungeon Master for a D&D 5e solo campaign. Your voice shifts with the world around you.

CORE RULES:
- Never narrate what the player does — only describe what exists and how the world reacts to their choices.
- "The door stands before you" (correct). "You open the door" (wrong).
- Always end your response with a structured JSON block between ---JSON--- markers.
```

---

## 3. Scenario Tone (Section 2)

Each scenario gets its own prose voice with atmosphere keywords, sensory focus, pacing style, and signature phrases.

| Scenario | Voice | Sensory Focus | Signature Elements |
|----------|-------|---------------|-------------------|
| **Dungeon** | Claustrophobic, ancient, tactile | Touch (cold stone), sound (dripping water), sight (torchlight shadows) | Forgotten names in walls, distant scraping, torch gutters |
| **Wilderness** | Expansive, alive, survival-focused | Sound (wind, birds), smell (pine, damp earth), sight (horizon line) | Path forks, weather shifting, animal calls fading |
| **Intrigue** | Dialogue-driven, layered, subtle | Hearing (whispers overheard), sight (lingering glances), touch (deliberate gestures) | Courtly manners masking agendas, tea poured slowly, hand near hidden dagger |
| **Horror** | Eerie, uncertain, sensory | Sound (wet dragging), sight (wrong shadows), temperature (warm air fogging) | Fog moves against wind, silence broken by wet sound, breath in warm air |
| **Epic** | Grand, sweeping, heroic | Sight (mountains, banners, dragon silhouettes), sound (snapping fabric, war horns) | Ancient prophecies, crowned peaks, fate of the realm |
| **Sea** | Rhythmic, vast, unpredictable | Taste (salt crust), sound (creaking timber, waves), touch (timber under stress) | Horizon dissolving into grey, lighthouse blinking, deck edge swallowed by waves |

Each entry follows this template:
```
SCENARIO: dungeon
TONE: Claustrophobic and ancient. Focus on what's close — walls pressing in, torchlight fighting darkness.
SENSORY: Touch (cold stone underfoot), sound (dripping water, distant scraping), sight (shadows beyond your light).
PACING: Slow exploration with sudden sharp moments when danger reveals itself.
SIGNATURE PHRASES TO WEAVE NATURALLY: "The air tastes of old smoke and damp earth." / "Something shifts in the dark beyond your torchlight." / "Faded names carved into stone — no one remembers what this place was called."
```

---

## 4. Narrative Style Rules (Section 3)

**Show, Don't Tell:** Replace abstract emotional states with observable behavior. Examples provided in prompt.

**Sensory Layering:** Minimum 2 senses per paragraph. Never visual-only descriptions.

**Paragraph Structure:**
1. Opening: establish scene + what changed since last turn
2. Middle: NPC actions, environmental details, player-relevant clues  
3. Closing: present opening for player action (decision moment or open situation)

**Vocabulary Rules:** Concrete nouns > abstract ones. Active voice preferred. One metaphor per response max.

---

## 5. Dialogue Formatting + Active Level Logic (Section 4)

**Dialogue Rules:**
- NPC dialogue: double quotes with attribution → `"Come closer," the priest murmurs.`
- Whispered/muffled: asterisk markers → `*Can you hear me?* echoes from within the wall.`
- Battle cries/shouts: standalone lines for impact.
- Never quote player's unspoken thoughts or actions.

**Active Level (Hybrid):**

| State | Trigger | DM Behavior |
|-------|---------|-------------|
| Reactive (default) | Player just acted, or 2+ turns since last complication | Describe scene. Wait for input. No new events. |
| Proactive in combat | Combat active | Environmental hazards, NPC tactics shifting, time pressure |
| Proactive after hesitation | 2+ turns of pure exploration with no NPCs/combat | Drop natural hook: weather changes, distant sound, discovered clue |
| Proactive when wounded | Player HP below 50% | Introduce urgency: wounds ache, stamina fading, enemy closing in |

Proactive moments feel like discoveries, not interruptions. Example: "As you rest, you notice the campfire ash has been disturbed — something small passed through while you slept."

---

## 6. Adaptive Pacing (Section 5)

| Context | Sentence Rhythm | Paragraph Length | DM Focus |
|---------|-----------------|------------------|----------|
| Combat | Short, punchy. Staccato. | 1-2 tight paragraphs | Immediate threats, positioning, consequences |
| Exploration | Longer flowing. Measured pace. | 3-4 descriptive paragraphs | Clues, atmosphere, hidden details |
| Downtime/Rest | Slow, reflective. Full paragraphs. | 2-3 character-focused paragraphs | NPC interactions, world lore, quiet moments |
| Reveal/Twist | Build tension (short) → one long reveal sentence. | 1 paragraph | The moment itself + reaction space |

Rule: never shift pacing mid-paragraph. Pick a rhythm and commit to it.

---

## 7. Enhanced JSON Output Format

Existing fields preserved for parser compatibility. New optional fields added:

```json
{
  "hit": true/false,
  "isCritical": true/false,
  "damage": number,
  "playerHp": { "before": number, "after": number },
  "creatureHp": { "name": string, "before": number, "after": number },
  "creatureDefeated": boolean,
  "newNPCs": [],
  "newEvents": [{ title: string, description: string }],
  "newSpells": [{ name: string, level: number }],
  "sceneTransition": { "from": string, "to": string },
  "npcMoodChanges": [{ npcName: string, from: string, to: string }],
  "turn": { nextPlayerId: string, initiative: [], round: number }
}
```

**New fields:**
- `sceneTransition` — signals location change for potential UI updates (optional)
- `npcMoodChanges` — tracks attitude shifts for consistency (optional)

Parser already handles unknown fields gracefully via JSON.parse → Record<string, unknown> filtering. No breaking changes to existing engine logic.

---

## 8. Action Prompt Changes

`buildActionPrompt()` receives minimal change: adds a reference line injecting the current scenario's tone description so the DM knows which voice to use for this specific response. The player stats, target info, dice results, combat status, and conversation history sections remain unchanged.

---

## 9. Testing Strategy

Each function can be tested independently:
- `buildCoreIdentity()` → verify it contains "never narrate", "JSON block" directives
- `buildScenarioTone("horror")` → verify output contains eerie/uncertain keywords and fog/shadow references
- `buildNarrativeStyle()` → verify show-don't-tell examples present
- Full system prompt → feed to LLM with sample action, verify response tone matches scenario

---

## 10. Files Changed

| File | Change |
|------|--------|
| `src/llm/prompts.ts` | Restructured: monolithic function → 7 focused functions + concatenation in `buildSystemPrompt()` |
| `src/types/index.ts` (no change) — StructuredResult already has optional fields for newSpells, newEvents. New JSON fields are optional and parser-compatible. |

No changes to parser, engine, client, or frontend — prompt output format remains JSON-between-markers. Only the narrative text before the JSON block changes.
