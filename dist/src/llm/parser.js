export function parseLLMResponse(content) {
    // Try to match JSON block with flexible whitespace handling
    const jsonMatch = content.match(/---JSON---\s*([\s\S]*?)\s*---JSON---/);
    let structured;
    if (jsonMatch) {
        try {
            structured = JSON.parse(jsonMatch[1]);
        }
        catch {
            structured = createFallbackResult();
        }
    }
    else {
        // No JSON block found - use entire content as narrative
        structured = createFallbackResult();
    }
    // Extract only the narrative part (before JSON block)
    const narrativeMatch = content.match(/^([\s\S]*?)\s*---JSON---/);
    const narrative = narrativeMatch ? narrativeMatch[1].trim() : content.trim();
    return { fullNarrative: narrative || content, structured };
}
function createFallbackResult() {
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
//# sourceMappingURL=parser.js.map