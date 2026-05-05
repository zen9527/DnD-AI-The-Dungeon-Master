# Phase 3: Advanced D&D Mechanics & Enhanced DM Experience

> **Date**: 2026-05-04  
> **Status**: Proposed (awaiting user approval)  
> **Previous**: Phase 1 (Multi-player Social), Phase 2 (Cooperative Gameplay & Persistence)

---

## Overview

Phase 3 focuses on **advanced D&D 5e mechanics**, **enhanced DM tools**, and **improved game flow**. The goal is to make the AI Dungeon Master more immersive, responsive, and mechanically accurate.

---

## Proposed Features

### 1. Combat System Enhancement ⚔️

**Current State**: Basic combat with dice rolls and HP tracking  
**Phase 3 Goals**:

- [ ] **Initiative Tracking System**
  - Auto-roll initiative for all players and NPCs at combat start
  - Display initiative order in UI
  - Enforce turn order during combat
  - Allow DM to override initiative manually

- [ ] **Combat Actions Menu**
  - Attack (with weapon selection)
  - Cast Spell (with spell slot tracking)
  - Use Item (potions, scrolls, etc.)
  - Dash / Disengage / Dodge
  - Help / Hide
  - Ready Action
  - Bonus Action tracking

- [ ] **Attack Resolution**
  - Auto-calculate attack bonus (proficiency + ability mod)
  - Advantage/disadvantage detection based on conditions
  - Critical hit/miss detection (natural 20/1)
  - Damage roll with damage type (slashing, fire, etc.)
  - AC comparison against target

- [ ] **Spell Casting System**
  - Spell slot exhaustion tracking
  - Cantrip (unlimited use) vs. leveled spells
  - Spell save DC calculation
  - Area of effect notation (for DM reference)
  - Concentration tracking

### 2. Inventory & Equipment System 🎒

**Current State**: Basic inventory array, no mechanics  
**Phase 3 Goals**:

- [ ] **Item Types & Categories**
  - Weapons (melee/ranged, damage types)
  - Armor (light/medium/heavy, AC values)
  - Tools (thieves' tools, musical instruments)
  - Consumables (potions, scrolls, grenades)
  - Gear (rope, torches, rations)

- [ ] **Equipment Equipping**
  - Equip/unequip weapons and armor
  - Auto-update AC based on equipped armor
  - Auto-update attack bonuses based on equipped weapon
  - Two-handed vs. one-handed weapon tracking
  - Off-hand weapon for dual-wielding

- [ ] **Weight & Encumbrance**
  - Item weight tracking
  - Total carried weight calculation
  - Encumbrance penalties (optional D&D variant rule)
  - Bag of Holding / portable storage support

### 3. Enhanced DM Tools 🎭

**Current State**: DM has basic chat and timer  
**Phase 3 Goals**:

- [ ] **DM Control Panel**
  - Manual NPC HP adjustment
  - Condition application/removal UI
  - XP award button (manual distribution)
  - Encounter builder helper
  - Loot generator

- [ ] **Encounter Builder**
  - Add NPCs with pre-built stat blocks
  - CR (Challenge Rating) calculation
  - Party strength analysis
  - Encounter difficulty estimation (Easy/Medium/Hard/Deadly)
  - Save encounter templates for reuse

- [ ] **Loot & Rewards System**
  - Gold piece tracking per player
  - Magic item generation (by tier: common/rare/legendary)
  - Loot distribution suggestions
  - Treasure hoard generator

- [ ] **DM Notes & Secrets**
  - Private DM notes (not visible to players)
  - Spoiler/reveal mechanism (DM can reveal secrets to players)
  - Location descriptions database
  - NPC background notes

### 4. Improved Game Flow 🔄

**Current State**: Basic turn timer, sequential turns  
**Phase 3 Goals**:

- [ ] **Combat Mode Toggle**
  - Switch between "Roleplay Mode" and "Combat Mode"
  - Combat mode: strict turn order, initiative tracking
  - Roleplay mode: flexible turns, DM discretion

- [ ] **Round Tracking**
  - Display current combat round number
  - Track effects with duration (e.g., "Bless: 3 rounds remaining")
  - Auto-expire timed effects

- [ ] **Status Effects & Buffs**
  - Temporary HP tracking
  - Spell effects (Bless, Haste, Invisibility, etc.)
  - Duration countdown
  - Auto-remove expired effects

- [ ] **Death Save System Enhancement**
  - Visual death save tracker for unconscious players
  - Stabilize mechanic (DC 10 CON save or medical aid)
  - Revival options (spells, potions, DM intervention)
  - Critical failure consequences

### 5. Character Sheet Enhancement 📋

**Current State**: Basic character creation with race/class  
**Phase 3 Goals**:

- [ ] **Background & Traits**
  - Background selection (Criminal, Noble, Sage, etc.)
  - Personality traits, ideals, bonds, flaws
  - Background skill proficiencies
  - Equipment packages by background

- [ ] **Feats System**
  - Feat selection at level 4, 8, 12, etc.
  - Feat descriptions and effects
  - Ability score improvement vs. feat choice

- [ ] **Multiclassing Support** (Optional)
  - Multiclass prerequisites check
  - Combined level vs. individual class levels
  - Combined spell slot calculation
  - Proficiency stacking rules

### 6. Performance & UX Improvements 🚀

**Current State**: Working but can be optimized  
**Phase 3 Goals**:

- [ ] **Lazy Loading for Chat History**
  - Only load last 50 messages initially
  - Load older messages on scroll up
  - Reduce initial page load time

- [ ] **Offline Mode Support**
  - Queue actions when WebSocket disconnected
  - Auto-retry with exponential backoff
  - Show "offline" indicator clearly

- [ ] **Keyboard Shortcuts**
  - `Ctrl+Enter` to send action
  - `Tab` to switch between chat and action bar
  - `1-5` to select quick actions
  - `Esc` to close modals

- [ ] **Mobile Responsive Design**
  - Touch-friendly action buttons
  - Collapsible panels for small screens
  - Swipe gestures for navigation

---

## Technical Architecture

### Backend Changes

| Component | Changes |
|-----------|---------|
| `src/game/engine.ts` | Initiative tracking, combat mode, spell slot management |
| `src/game/rules.ts` | Attack calculation, damage types, spell mechanics |
| `src/types/index.ts` | Equipment, feats, backgrounds, combat state |
| `shared/schemas/` | Combat action schemas, equipment schemas |

### Frontend Changes

| Component | Changes |
|-----------|---------|
| `public/js/app.ts` | Combat UI, inventory panel, DM controls |
| `public/js/character.ts` | Enhanced character sheet with equipment |
| `public/js/game-state.ts` | Combat state, initiative order |
| `public/css/style.css` | Combat mode styling, equipment display |

### New Files

```
src/game/
  ├── combat.ts           # Combat mechanics (initiative, turn order)
  ├── inventory.ts        # Equipment management
  └── spells.ts           # Spell casting rules

shared/schemas/
  ├── combat.ts           # Combat action payloads
  ├── equipment.ts        # Item/equipment schemas
  └── spells.ts           # Spell casting schemas

public/js/
  ├── combat-ui.ts        # Combat mode interface
  ├── inventory-ui.ts     # Inventory management UI
  └── dm-controls.ts      # DM-specific controls
```

---

## Implementation Priority

### High Priority (Must Have)
1. **Combat System Enhancement** - Initiative, turn order, attack resolution
2. **Improved Game Flow** - Combat mode toggle, round tracking
3. **DM Control Panel** - Manual NPC/condition/XM management

### Medium Priority (Should Have)
4. **Inventory & Equipment** - Basic equip/unequip, AC updates
5. **Status Effects & Buffs** - Temporary HP, spell durations
6. **Performance Improvements** - Lazy loading, offline mode

### Low Priority (Nice to Have)
7. **Character Sheet Enhancement** - Backgrounds, feats
8. **Multiclassing Support** - Complex rules, optional feature
9. **Mobile Responsive** - UX improvement

---

## Estimated Timeline

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Combat System | 2-3 weeks | Initiative + attack resolution working |
| Inventory System | 1-2 weeks | Equipment equip/unequip + AC updates |
| DM Tools | 1-2 weeks | Control panel + encounter builder |
| Game Flow | 1 week | Combat mode toggle + round tracking |
| Polish & Testing | 1 week | Bug fixes, UX improvements |

**Total**: ~6-9 weeks (depending on complexity)

---

## Dependencies

- Phase 1 complete ✅ (Multi-player, timer, chat)
- Phase 2 complete ✅ (Conditions, XP, persistence)
- LLM API stable (for combat narration)
- Player feedback on current bugs (just fixed: chat messages + timer refresh)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Combat rules too complex | High | Start with simplified rules, add complexity gradually |
| LLM doesn't follow combat format | Medium | Improve prompts, add structured output validation |
| Performance degradation with large games | Medium | Implement lazy loading, optimize state updates |
| Mobile UX issues | Low | Test early, iterate on responsive design |

---

## Success Criteria

- [ ] Combat mode can be toggled seamlessly
- [ ] Initiative order is enforced automatically
- [ ] Attack rolls auto-calculate bonuses and AC comparison
- [ ] Spell slots track usage and exhaustion
- [ ] Equipment updates character stats (AC, attack bonus)
- [ ] DM has full control over NPCs, conditions, XP
- [ ] Game flow is smooth with round tracking
- [ ] All existing Phase 1-2 features still work

---

## Open Questions

1. **Should combat be automatic or DM-controlled?**
   - Option A: Auto-resolve attacks (backend calculates)
   - Option B: DM decides outcomes (backend suggests)
   - Recommendation: Hybrid - auto-resolve dice, DM decides narrative

2. **How complex should spell system be?**
   - Option A: Simple (spell slots only)
   - Option B: Full D&D 5e (components, casting time, range)
   - Recommendation: Start with Option A, expand later

3. **Should we support official D&D 5e stat blocks?**
   - Option A: Custom NPC builder only
   - Option B: Import from SRD / D&D Beyond
   - Recommendation: Option A first, Option B as future enhancement

---

## Next Steps

1. **User Approval** - Review this proposal and approve/reject features
2. **Priority Ordering** - Confirm which features to implement first
3. **Implementation Plan** - Create detailed task breakdown (like Phase 2)
4. **Start Development** - Use subagent-driven-development for execution

---

**Author**: OpenCode AI Assistant  
**Review**: Pending user approval
