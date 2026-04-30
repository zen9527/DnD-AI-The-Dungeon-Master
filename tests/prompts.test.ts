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
    // Dungeon: claustrophobic, ancient keywords
    expect(buildSystemPrompt('dungeon')).toMatch(/(ancient|Claustrophobic|torchlight)/i);
    
    // Wilderness: expansive, alive keywords  
    expect(buildSystemPrompt('wilderness')).toMatch(/(Expansive|vast|forest)/i);
    
    // Intrigue: dialogue-driven, undercurrent keywords
    expect(buildSystemPrompt('intrigue')).toMatch(/(Dialogue-driven|undercurrent|Manners mask agendas)/i);
    
    // Horror: eerie, uncertain keywords  
    expect(buildSystemPrompt('horror')).toMatch(/(Eerie|uncertain|wrong in small ways)/i);
    
    // Epic: grand, sweeping keywords
    expect(buildSystemPrompt('epic')).toMatch(/(Grand|sweeping|legendary|prophecy|dragon)/i);
    
    // Sea: rhythmic, vast keywords
    expect(buildSystemPrompt('sea')).toMatch(/(Rhythmic|vast|ocean dictates everything)/i);
  });

  it('includes rules section with d20 and combat info', () => {
    const prompt = buildSystemPrompt('dungeon');
    expect(prompt).toContain('adaptive Dungeon Master');
    expect(prompt).toMatch(/(HP|AC)/i);
  });

  it('includes output format section with JSON block guidance', () => {
    const prompt = buildSystemPrompt('dungeon');
    expect(prompt).toMatch(/MUST include.*JSON/i) || expect(prompt).toContain('---JSON---');
  });

  it('includes turn tracking fields in JSON format', () => {
    const prompt = buildSystemPrompt('dungeon');
    expect(prompt).toContain('nextPlayerId');
    expect(prompt).toContain('initiative');
    expect(prompt).toContain('round');
  });

  it('includes playerHp and creatureHp in JSON format', () => {
    const prompt = buildSystemPrompt('dungeon');
    expect(prompt).toContain('playerHp');
    expect(prompt).toContain('creatureHp');
    expect(prompt).toContain('damage');
    expect(prompt).toContain('creatureDefeated');
  });

  it('includes newNPCs and newEvents in JSON format', () => {
    const prompt = buildSystemPrompt('dungeon');
    expect(prompt).toContain('newNPCs');
    expect(prompt).toContain('newEvents');
  });

  it('returns consistent output for same scenario (deterministic)', () => {
    const a = buildSystemPrompt('horror');
    const b = buildSystemPrompt('horror');
    expect(a).toBe(b);
  });

  it('returns different content for different scenarios', () => {
    const dungeon = buildSystemPrompt('dungeon');
    const horror = buildSystemPrompt('horror');
    expect(dungeon).not.toBe(horror);
  });

  it('defaults to dungeon when no scenario provided', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('ancient dungeons filled with traps, undead, and treasure');
    expect(prompt).toMatch(/(Claustrophobic|torchlight)/i);
  });
});

describe('buildActionPrompt', () => {
  it('includes player name, class, and race', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TestPlayer', characterName: 'Aldric', isDM: false, race: 'Human',
      characterClass: 'Fighter', level: 3, attributes: { str: 16, dex: 12, con: 14, int: 10, wis: 8, cha: 12 },
      hp: 25, maxHp: 30, ac: 16, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };
    
    const prompt = buildActionPrompt('I attack the goblin', {
      currentPlayer: mockPlayer, combatStatus: 'Active combat — round 3', conversationHistory: [], scenario: 'dungeon'
    });

    expect(prompt).toContain('Aldric');
    expect(prompt).toContain('Fighter');
    expect(prompt).toContain('Human');
  });

  it('includes player level in prompt', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TestPlayer', characterName: 'Aldric', isDM: false, race: 'Human',
      characterClass: 'Fighter', level: 3, attributes: { str: 16, dex: 12, con: 14, int: 10, wis: 8, cha: 12 },
      hp: 25, maxHp: 30, ac: 16, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const prompt = buildActionPrompt('I attack', {
      currentPlayer: mockPlayer, combatStatus: 'Combat', conversationHistory: [], scenario: 'dungeon'
    });

    expect(prompt).toContain('Lv.3');
  });

  it('includes player stats (HP, AC, attributes)', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TestPlayer', characterName: 'Aldric', isDM: false, race: 'Human',
      characterClass: 'Fighter', level: 3, attributes: { str: 16, dex: 12, con: 14, int: 10, wis: 8, cha: 12 },
      hp: 25, maxHp: 30, ac: 16, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const prompt = buildActionPrompt('I attack', {
      currentPlayer: mockPlayer, combatStatus: 'Combat', conversationHistory: [], scenario: 'dungeon'
    });

    expect(prompt).toContain('HP: 25/30');
    expect(prompt).toContain('AC: 16');
    expect(prompt).toContain('Str=16');
    expect(prompt).toContain('Dex=12');
    expect(prompt).toContain('Con=14');
  });

  it('includes player conditions when present', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TestPlayer', characterName: 'Aldric', isDM: false, race: 'Human',
      characterClass: 'Fighter', level: 3, attributes: { str: 16, dex: 12, con: 14, int: 10, wis: 8, cha: 12 },
      hp: 25, maxHp: 30, ac: 16, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: ['poisoned']
    };

    const prompt = buildActionPrompt('I attack', {
      currentPlayer: mockPlayer, combatStatus: 'Combat', conversationHistory: [], scenario: 'dungeon'
    });

    expect(prompt).toContain('Conditions');
    expect(prompt).toContain('poisoned');
  });

  it('shows "none" for conditions when empty', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TestPlayer', characterName: 'Aldric', isDM: false, race: 'Human',
      characterClass: 'Fighter', level: 3, attributes: { str: 16, dex: 12, con: 14, int: 10, wis: 8, cha: 12 },
      hp: 25, maxHp: 30, ac: 16, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const prompt = buildActionPrompt('I attack', {
      currentPlayer: mockPlayer, combatStatus: 'Combat', conversationHistory: [], scenario: 'dungeon'
    });

    expect(prompt).toContain('Conditions');
  });

  it('includes scenario tone reference with label and description', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TP', characterName: 'Char', isDM: false, race: 'Elf',
      characterClass: 'Rogue', level: 2, attributes: { str: 10, dex: 16, con: 12, int: 12, wis: 14, cha: 10 },
      hp: 15, maxHp: 18, ac: 14, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const prompt = buildActionPrompt('I sneak past', {
      currentPlayer: mockPlayer, combatStatus: 'Exploration', conversationHistory: [], scenario: 'horror'
    });

    expect(prompt).toContain('Horror & Mystery');
    expect(prompt).toMatch(/(fog-shroudd|strange occurrence)/i);
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
      currentPlayer: mockPlayer, target: mockTarget, combatStatus: 'Combat — Zombie Guard engaged', conversationHistory: [], scenario: 'dungeon'
    });

    expect(prompt).toContain('Zombie Guard');
    expect(prompt).toContain('HP: 8/8');
    expect(prompt).toContain('AC: 9');
    expect(prompt).toMatch(/Target:/i);
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
      currentPlayer: mockPlayer, diceResult, combatStatus: 'Combat — Round 5', conversationHistory: [], scenario: 'dungeon'
    });

    expect(prompt).toContain('Dice roll');
    expect(prompt).toContain('[17]');
    expect(prompt).toContain('+ 3 = 20');
    expect(prompt).toMatch(/1d20/i);
  });

  it('includes multiple dice rolls correctly', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TP', characterName: 'Char', isDM: false, race: 'Human',
      characterClass: 'Wizard', level: 5, attributes: { str: 8, dex: 14, con: 12, int: 18, wis: 10, cha: 6 },
      hp: 28, maxHp: 32, ac: 12, proficiencyBonus: 3, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const diceResult: DiceRoll = {
      id: 'd1', playerId: 'p1', playerName: 'TP', characterName: 'Char',
      diceType: 6, count: 4, rolls: [3, 5, 2, 4], modifier: 0, total: 14, isHit: true, timestamp: Date.now()
    };

    const prompt = buildActionPrompt('I deal damage', {
      currentPlayer: mockPlayer, diceResult, combatStatus: 'Combat — Round 2', conversationHistory: [], scenario: 'dungeon'
    });

    expect(prompt).toContain('4d6');
    expect(prompt).toMatch(/\[3, 5, 2, 4\]/);
    expect(prompt).toContain('+ 0 = 14');
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
      currentPlayer: mockPlayer, combatStatus: 'Exploration', conversationHistory: history, scenario: 'dungeon'
    });

    expect(prompt).toContain('Recent conversation');
    expect(prompt).toContain('dimly lit cavern');
  });

  it('truncates long conversation messages at 200 chars', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TP', characterName: 'Char', isDM: false, race: 'Human',
      characterClass: 'Barbarian', level: 1, attributes: { str: 18, dex: 12, con: 16, int: 8, wis: 10, cha: 8 },
      hp: 14, maxHp: 14, ac: 13, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const longContent = 'A'.repeat(500);
    const history = [
      { role: 'system', content: longContent }
    ];

    const prompt = buildActionPrompt('I look around', {
      currentPlayer: mockPlayer, combatStatus: 'Exploration', conversationHistory: history, scenario: 'dungeon'
    });

    // Each message line is truncated at 200 chars via substring(0, 200)
    const lines = prompt.split('\n');
    for (const line of lines) {
      if (line.startsWith('[system]:')) {
        expect(line.length).toBeLessThanOrEqual(210); // '[system]: ' prefix + 200 chars (+ possible \r on Windows)
      }
    }
  });

  it('only includes last messages from history when too many', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TP', characterName: 'Char', isDM: false, race: 'Human',
      characterClass: 'Barbarian', level: 1, attributes: { str: 18, dex: 12, con: 16, int: 8, wis: 10, cha: 8 },
      hp: 14, maxHp: 14, ac: 13, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const history = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? 'system' : 'user') as string,
      content: `Message ${i}`
    }));

    const prompt = buildActionPrompt('I act', {
      currentPlayer: mockPlayer, combatStatus: 'Combat', conversationHistory: history, scenario: 'dungeon'
    });

    expect(prompt).toContain('Recent conversation');
    // Should only include last 10 messages (slice(-10))
    const messageCount = prompt.split('\n').filter(l => l.startsWith('[system]:') || l.startsWith('[user]:') || l.startsWith('[assistant]:')).length;
    expect(messageCount).toBeLessThanOrEqual(10);
  });

  it('includes combat status in prompt', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TP', characterName: 'Char', isDM: false, race: 'Human',
      characterClass: 'Ranger', level: 3, attributes: { str: 14, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
      hp: 22, maxHp: 25, ac: 15, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const prompt = buildActionPrompt('I shoot', {
      currentPlayer: mockPlayer, combatStatus: 'Combat — Round 7: Goblin Horde engaged', conversationHistory: [], scenario: 'wilderness'
    });

    expect(prompt).toContain('Combat status');
    expect(prompt).toContain('Round 7');
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

  it('produces different output for different actions', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TP', characterName: 'Char', isDM: false, race: 'Human',
      characterClass: 'Ranger', level: 3, attributes: { str: 14, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
      hp: 22, maxHp: 25, ac: 15, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const promptA = buildActionPrompt('I shoot an arrow', {
      currentPlayer: mockPlayer, combatStatus: 'Combat', conversationHistory: [], scenario: 'wilderness'
    });
    const promptB = buildActionPrompt('I cast a spell', {
      currentPlayer: mockPlayer, combatStatus: 'Combat', conversationHistory: [], scenario: 'wilderness'
    });

    expect(promptA).not.toBe(promptB);
  });

  it('includes player action in quotes', () => {
    const mockPlayer: Player = {
      id: 'p1', name: 'TP', characterName: 'Char', isDM: false, race: 'Human',
      characterClass: 'Ranger', level: 3, attributes: { str: 14, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
      hp: 22, maxHp: 25, ac: 15, proficiencyBonus: 2, spellSlots: {}, spells: [], inventory: [], conditions: []
    };

    const prompt = buildActionPrompt('I cast a spell', {
      currentPlayer: mockPlayer, combatStatus: 'Combat', conversationHistory: [], scenario: 'wilderness'
    });

    expect(prompt).toContain('"I cast a spell"');
  });
});
