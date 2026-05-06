import type { StreamResult, StructuredResult } from "../types/index.js";

/**
 * Parse LLM response and extract structured result from JSON block.
 * Uses flexible ---JSON--- markers with whitespace handling.
 */
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
      currentTurnIndex: 0,
    },
  };
}
