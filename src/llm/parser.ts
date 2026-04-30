import type { StreamResult, StructuredResult } from "../types/index.js";

export function parseLLMResponse(content: string): StreamResult {
  // Try to match JSON block with flexible whitespace handling
  const jsonMatch = content.match(/---JSON---\s*([\s\S]*?)\s*---JSON---/);

  let structured: StructuredResult;
  if (jsonMatch) {
    try {
      structured = JSON.parse(jsonMatch[1]) as StructuredResult;
    } catch {
      structured = createFallbackResult();
    }
  } else {
    // No JSON block found - use entire content as narrative
    structured = createFallbackResult();
  }

  // Extract only the narrative part (before JSON block)
  const narrativeMatch = content.match(/^([\s\S]*?)\s*---JSON---/);
  const narrative = narrativeMatch ? narrativeMatch[1].trim() : content.trim();

  return { fullNarrative: narrative || content, structured };
}

function createFallbackResult(): StructuredResult {
  return {
    hit: false,
    isCritical: false,
    playerHp: undefined,
    creatureHp: undefined,
    creatureDefeated: false,
    newNPCs: undefined,
    newEvents: undefined,
    newSpells: undefined,
    turn: {
      nextPlayerId: "",
      initiative: [],
      round: 1,
    },
  };
}

/**
 * Extract new spells learned from LLM response content.
 * Called by engine to parse spell discoveries from the structured JSON block.
 */
export function extractSpellsFromResponse(content: string): Array<{ name: string; level: number }> {
  const jsonMatch = content.match(/---JSON---\s*([\s\S]*?)\s*---JSON---/);
  if (!jsonMatch) return [];

  try {
    const data = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
    const newSpellsRaw = (data.newSpells || []) as Array<{ name: string; level: number }>;
    
    // Validate each spell entry — must have name and valid level (1-9)
    return newSpellsRaw.filter(s => 
      typeof s.name === 'string' && 
      typeof s.level === 'number' && 
      s.level >= 1 && s.level <= 9
    ).map(s => ({ name: s.name, level: s.level }));
  } catch {
    return [];
  }
}
