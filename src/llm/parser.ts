import type { StreamResult, StructuredResult } from "../types/index.js";

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

  const narrative = content.replace(/---JSON---[\s\S]*---JSON---/, "").trim();

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
    turn: {
      nextPlayerId: "",
      initiative: [],
      round: 1,
    },
  };
}
