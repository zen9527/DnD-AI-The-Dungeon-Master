import type { StreamResult, StructuredResult } from "../../src/types/index.js";

/**
 * Split an LLM reply into its prose narrative and the structured result the DM
 * prompt asks for. The JSON payload is delimited by `---JSON---` on both sides;
 * a missing or malformed block degrades to a neutral fallback rather than
 * failing, so a chatty model can never break the turn.
 *
 * Lives in `shared/` because both the server (streaming completion) and the
 * browser (incremental stream buffer) parse the same format.
 */
export function parseLLMResponse(content: string): StreamResult {
  const jsonMatch = content.match(/---JSON---\s*([\s\S]*?)\s*---JSON---/);

  let structured: StructuredResult;
  if (jsonMatch) {
    try {
      structured = JSON.parse(jsonMatch[1]) as StructuredResult;
    } catch {
      structured = createFallbackResult();
    }
  } else {
    structured = createFallbackResult();
  }

  // The narrative is everything before the JSON block.
  const narrativeMatch = content.match(/^([\s\S]*?)\s*---JSON---/);
  const narrative = narrativeMatch ? narrativeMatch[1].trim() : content.trim();

  return { fullNarrative: narrative || content, structured };
}

/** A "nothing happened" result, used when the model omits or mangles the JSON block. */
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
