import type { Player, NPC, DiceRoll } from "../types/index.js";
import { type Scenario } from "../../shared/schemas/scenario.js";
export declare function buildSystemPrompt(scenario?: Scenario, locale?: string): string;
export declare function buildActionPrompt(action: string, context: {
    currentPlayer: Player;
    target?: NPC;
    diceResult?: DiceRoll;
    combatStatus: string;
    conversationHistory?: {
        role: string;
        content: string;
    }[];
    scenario: Scenario;
    locale?: string;
}): string;
//# sourceMappingURL=prompts.d.ts.map