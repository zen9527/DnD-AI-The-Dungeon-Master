import type { Player, NPC, DiceRoll } from "../types/index.js";
import { scenarioDescriptions, type Scenario } from "../../shared/schemas/scenario.js";

const SCENARIO_CONTEXT: Record<Scenario, string> = {
  dungeon: `You are in a dark, ancient dungeon. Corridors are filled with torchlight, traps, and lurking undead. Treasure awaits but danger is everywhere. Goblins, skeletons, and guardians patrol the depths.`,
  wilderness: `You are in a vast wilderness. Dense forests, mountain passes, and untamed lands. Survival is key. Wolves, druids, bandits, and natural hazards threaten the party.`,
  intrigue: `You are in a world of noble courts and secret alliances. Politics, diplomacy, and betrayal are the primary dangers. Nobles, spies, merchants, and assassins shape the landscape.`,
  horror: `You are in a fog-shrouded, eerie setting. Strange occurrences, cultists, and supernatural horrors lurk in the shadows. The atmosphere is tense and unsettling.`,
  epic: `You are in a legendary world where ancient evil stirs. Prophecies, gods, dragons, and heroic quests define this adventure. The fate of the realm hangs in the balance.`,
  sea: `You are on the open ocean. Shipwrecks, pirate islands, and sea creatures await. Storms, treasure maps, and naval battles shape the adventure.`,
};

export function buildSystemPrompt(scenario: Scenario = "dungeon"): string {
  return `You are the Dungeon Master for a D&D 5e game.

SCENARIO: ${SCENARIO_CONTEXT[scenario]}

RULES:
- Use d20 for all checks. Natural 20 = critical hit (double damage).
- Hit: roll + attack bonus >= target AC.
- Each player has: HP, AC, attributes (Str/Dex/Con/Int/Wis/Cha), inventory, spell slots, conditions.
- Combat: initiative order, actions, movement, bonus actions.
- Keep descriptions vivid but concise.

OUTPUT FORMAT:
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
  "newEvents": [],
  "turn": {
    "nextPlayerId": "string",
    "initiative": [{ "playerId": "string", "npcId?: string", "score": number }],
    "round": number
  }
}
---JSON---

ALWAYS include the JSON block. It must be valid JSON between the ---JSON--- markers.`;
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
- Attributes: Str=${target.attributes.str} Dex=${target.attributes.dex} Con=${target.attributes.con}
`;
  }

  if (context.diceResult) {
    prompt += `\nDice roll: ${context.diceResult.count}d${context.diceResult.diceType} = [${context.diceResult.rolls.join(", ")}] + ${context.diceResult.modifier} = ${context.diceResult.total}
`;
  }

  prompt += `\nCombat status: ${context.combatStatus}

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
