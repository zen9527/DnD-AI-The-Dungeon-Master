import { generateId } from "../utils/id.js";
import { rollDice, calculateTotal, calculateModifier, calculateProficiencyBonus } from "./dice.js";
import {
  isHit,
  rollHitDice,
  getActionSkillCheck,
  CLASS_SKILL_PROFICIENCIES,
  calculateCombinedCheck,
  awardXP,
} from "./rules.js";
import { LLMClient, type LLMCallbacks } from "../llm/client.js";
import { buildSystemPrompt, buildActionPrompt } from "../llm/prompts.js";
import { parseLLMResponse } from "../../shared/utils/parseLLMResponse.js";
import type { ChatMessage, DiceRoll, Game, NPC, Player, PlayerActionPayload, StreamResult } from "../types/index.js";
import { scenarioDescriptions, type Scenario } from "../../shared/schemas/scenario.js";
import { LOCALE_LLM_NAME } from "../../shared/schemas/locale.js";
import { getLocalizedMessage } from "../utils/locale-loader.js";
import type { GameState } from "./game-state.js";
import type { CombatService } from "./combat.js";

type LLMMessage = { role: "system" | "user" | "assistant"; content: string };

/** Turns of conversation replayed verbatim; the summary covers everything older. */
const RECENT_HISTORY_TURNS = 4;
/** Hard cap on stored conversation history, excluding the system message. */
const MAX_HISTORY_LENGTH = 20;
/** Chat log is trimmed to this many messages to bound memory and save size. */
const MAX_CHAT_HISTORY = 100;
/** Refresh the rolling story summary every N player turns. */
const SUMMARY_INTERVAL = 5;
/** XP granted for defeating an NPC. Flat for now; should scale with CR. */
const XP_PER_DEFEATED_ENEMY = 50;

const ACTION_STREAM_TIMEOUT_MS = 60000;
const OPENING_STREAM_TIMEOUT_MS = 90000;
const SUMMARY_STREAM_TIMEOUT_MS = 30000;

/**
 * Everything that talks to the LLM: prompt assembly, streaming, and folding the
 * model's structured result back into game state.
 *
 * Long-term memory is a rolling `storySummary` refreshed every few turns, which
 * lets the prompt carry only the last handful of exchanges verbatim.
 */
export class LLMInteractionService {
  /** Rolling digest of the adventure so far, injected into every prompt. */
  private storySummary = "";
  private turnsSinceSummary = 0;

  constructor(
    private readonly state: GameState,
    private readonly llmClient: LLMClient,
    private readonly combat: CombatService
  ) {}

  private get game(): Game {
    return this.state.raw;
  }

  private scenario(): Scenario {
    return (this.game.scenario as Scenario) || "dungeon";
  }

  // ---- Prompt assembly ----

  /**
   * A compact snapshot of the world (~100 tokens) so the DM knows the current
   * situation without us resending full character sheets every turn.
   */
  private buildWorldState(player: Player): string {
    const npcSection = this.game.npcs.length > 0
      ? `NPCs present:\n${this.game.npcs.map(n => `  - ${n.name}: HP ${n.hp}/${n.maxHp} AC ${n.ac} [${n.role}]`).join("\n")}`
      : "NPCs present: none";

    return `WORLD STATE:
Player: ${player.characterName} HP ${player.hp}/${player.maxHp} AC ${player.ac}
${npcSection}
Combat: ${this.game.npcs.length > 0 ? `Active - Round ${this.combat.round}` : "None"}`;
  }

  /**
   * Assemble the prompt: system rules, the story summary, current world state,
   * the last few exchanges, and finally the new user turn.
   */
  private buildMessages(player: Player, userContent: string): LLMMessage[] {
    const messages: LLMMessage[] = [
      { role: "system", content: buildSystemPrompt(this.scenario(), player.locale || "en-US") },
    ];

    if (this.storySummary) {
      messages.push({ role: "user", content: `ADVENTURE SUMMARY (key events so far):\n${this.storySummary}` });
      messages.push({ role: "assistant", content: "Understood. I'll keep this context in mind as the adventure continues." });
    }

    messages.push({ role: "user", content: this.buildWorldState(player) });

    // Index 0 is the system message and is never replayed as history.
    const historyStart = Math.max(1, this.game.conversationHistory.length - RECENT_HISTORY_TURNS * 2);
    messages.push(
      ...this.game.conversationHistory.slice(historyStart).map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }))
    );

    messages.push({ role: "user", content: userContent });
    return messages;
  }

  /** Record one exchange and trim history back to the cap. */
  private recordExchange(userContent: string, assistantContent: string): void {
    this.state.mutate(game => {
      game.conversationHistory.push({ role: "user", content: userContent });
      game.conversationHistory.push({ role: "assistant", content: assistantContent });

      if (game.conversationHistory.length > MAX_HISTORY_LENGTH) {
        game.conversationHistory = [
          game.conversationHistory[0], // the system message
          ...game.conversationHistory.slice(-(MAX_HISTORY_LENGTH - 1)),
        ];
      }
    });
  }

  private pushChatMessage(message: ChatMessage): void {
    this.state.mutate(game => {
      game.chatHistory.push(message);
      if (game.chatHistory.length > MAX_CHAT_HISTORY) game.chatHistory.shift();
    });
  }

  // ---- Story summary (long-term memory) ----

  /**
   * Ask the model to condense recent history into a bullet-point summary.
   * Best-effort: a failure here must never fail the player's turn.
   */
  private async updateStorySummary(player: Player): Promise<void> {
    const recentHistory = this.game.conversationHistory.slice(-10);
    const historyText = recentHistory.map(m => `[${m.role}]: ${m.content.substring(0, 300)}`).join("\n");

    const locale = player.locale || "en-US";
    const language = LOCALE_LLM_NAME[locale as keyof typeof LOCALE_LLM_NAME] || "English";

    const summaryPrompt = `You are summarizing a D&D adventure for the Dungeon Master's reference.
${this.storySummary ? `CURRENT SUMMARY:\n${this.storySummary}\n\n` : ""}RECENT EVENTS:\n${historyText}

Write a concise adventure summary in ${language} (max 200 words). Include:
- Key locations visited and current location
- Important NPCs met (allies, enemies, their status)
- Major decisions and their consequences
- Current objectives or threats

Format as bullet points. Keep it factual, not narrative.`;

    try {
      const result = await this.llmClient.streamChat(
        [
          { role: "system", content: `You are a D&D adventure summarizer. Respond in ${language}. Be concise.` },
          { role: "user", content: summaryPrompt },
        ],
        {
          onChunk: () => {}, // Summaries are internal — never streamed to clients.
          onEnd: () => {},
          onError: err => console.warn(`[Engine] Story summary update failed: ${err.message}`),
        },
        SUMMARY_STREAM_TIMEOUT_MS
      );

      if (result.trim()) {
        this.storySummary = result.trim();
        console.log(`[Engine] Story summary updated (${result.length} chars)`);
      }
    } catch {
      console.warn(`[Engine] Story summary update skipped`);
    }
  }

  // ---- Dice ----

  /**
   * Decide what, if anything, gets rolled for this action: an explicit client
   * roll, or an auto-detected skill check for a preset action button.
   */
  private rollForAction(player: Player, payload: PlayerActionPayload, target?: NPC): DiceRoll | undefined {
    if (payload.dice) {
      const rolls = rollDice(payload.dice.type, payload.dice.count);
      const modifier = payload.dice.modifier || 0;
      const total = calculateTotal(rolls, modifier);

      return {
        id: generateId(),
        playerId: player.id,
        playerName: player.name,
        characterName: player.characterName,
        diceType: payload.dice.type,
        count: payload.dice.count,
        rolls,
        modifier,
        total,
        isHit: target ? isHit(total, player, target, 0).hit : true,
        timestamp: Date.now(),
      };
    }

    const skillCheck = getActionSkillCheck(payload.action);
    if (!skillCheck || skillCheck.dc <= 0) return undefined;

    const d20Rolls = rollDice(20, 1);
    const d20Total = calculateTotal(d20Rolls, 0);

    const abilityMod = calculateModifier(player.attributes[skillCheck.ability]);
    const isProficient = CLASS_SKILL_PROFICIENCIES[player.characterClass]?.includes(skillCheck.skill);
    const mainModifier = abilityMod + (isProficient ? calculateProficiencyBonus(player.level) : 0);

    // Each helper adds +2, per the "working together" optional rule.
    const helpers = payload.helpers?.length || 0;
    const combined = helpers > 0 ? calculateCombinedCheck(d20Total, mainModifier, helpers) : null;
    const helperBonus = combined?.helperBonus ?? 0;
    const total = combined?.total ?? d20Total + mainModifier;
    const success = total >= skillCheck.dc;

    console.log(
      helpers > 0
        ? `[CombinedCheck] ${skillCheck.skill}: ${total} vs DC ${skillCheck.dc} with ${helpers} helpers (+${helperBonus})`
        : `[AutoRoll] ${skillCheck.skill} check: ${total} vs DC ${skillCheck.dc} = ${success ? "SUCCESS" : "FAILURE"}`
    );

    return {
      id: generateId(),
      playerId: player.id,
      playerName: player.name,
      characterName: player.characterName,
      diceType: 20,
      count: 1,
      rolls: d20Rolls,
      modifier: mainModifier + helperBonus,
      total,
      isHit: success,
      timestamp: Date.now(),
      skillCheck: { skill: skillCheck.skill, dc: skillCheck.dc, success, helpers },
    };
  }

  // ---- Player action ----

  /**
   * Run one player turn: resolve special actions, roll, prompt the DM, stream
   * the narrative, then fold the structured result back into the game.
   */
  async handlePlayerAction(payload: PlayerActionPayload, playerId: string, callbacks: LLMCallbacks): Promise<StreamResult> {
    const player = this.game.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");

    const actionLower = payload.action.toLowerCase();
    if (actionLower.includes("rest")) {
      return this.handleShortRest(player, callbacks);
    }

    if (actionLower.includes("drink potion") || actionLower.includes("use potion") || actionLower.includes("potion of healing")) {
      this.applyPotionOfHealing(player);
      // Fall through — the DM still narrates the moment.
    }

    const target = payload.target
      ? this.game.npcs.find(n => n.name.toLowerCase().includes((payload.target as string).toLowerCase()))
      : undefined;

    const diceResult = this.rollForAction(player, payload, target);

    const combatStatus = this.game.npcs.length > 0
      ? `Combat active. ${this.game.npcs.length} NPC(s) present. Round ${this.combat.round}.`
      : `No active combat.`;

    const actionContext = buildActionPrompt(payload.action, {
      currentPlayer: player,
      target,
      diceResult,
      combatStatus,
      scenario: this.scenario(),
      locale: player.locale || "en-US",
    });

    this.consumeSpellSlot(player, actionContext);

    const result = await this.llmClient.streamChat(
      this.buildMessages(player, actionContext),
      callbacks,
      ACTION_STREAM_TIMEOUT_MS
    );
    const parsed = parseLLMResponse(result);

    this.recordExchange(actionContext, parsed.fullNarrative);
    this.applyStructuredResult(parsed, playerId);

    this.turnsSinceSummary++;
    if (this.turnsSinceSummary >= SUMMARY_INTERVAL) {
      this.turnsSinceSummary = 0;
      // Deliberately not awaited — the summary must not delay the response.
      this.updateStorySummary(player).catch(() => {});
    }

    if (diceResult) {
      parsed.structured.diceResult = diceResult;
      this.pushChatMessage({
        id: generateId(),
        playerId,
        playerName: player.name,
        characterName: player.characterName,
        content: "", // The client renders the dice result, not text.
        type: "roll",
        timestamp: Date.now(),
        diceResult,
      });
    }

    this.combat.advanceTurn();

    this.pushChatMessage({
      id: generateId(),
      content: parsed.fullNarrative,
      type: "narrative",
      timestamp: Date.now(),
    });

    return parsed;
  }

  /** Heal the player as if they drank a potion, and log it as an event. */
  private applyPotionOfHealing(player: Player): void {
    const healed = rollHitDice(player).healed;

    this.state.mutate(game => {
      const live = game.players.find(p => p.id === player.id);
      if (live) live.hp = Math.min(live.maxHp, live.hp + healed);
    });

    this.pushChatMessage({
      id: generateId(),
      content: getLocalizedMessage(player.locale || "en-US", "event.potion_healing")
        .replace("{healed}", healed.toString())
        .replace("{hp}", player.hp.toString())
        .replace("{maxHp}", player.maxHp.toString()),
      type: "event",
      timestamp: Date.now(),
    });
  }

  /**
   * Spend a slot if the action names a spell the player knows. Casting with no
   * slots left is allowed through — the DM narrates the fizzle.
   */
  private consumeSpellSlot(player: Player, actionContext: string): void {
    const spell = player.spells?.find(s => actionContext.toLowerCase().includes(s.name.toLowerCase()));
    if (!spell) return;

    const key = `level-${spell.level}`;
    const available = player.spellSlots?.[key] || 0;
    if (available <= 0) {
      console.log(`[Engine] No slots for spell: ${spell.name}`);
      return;
    }

    this.state.mutate(game => {
      const live = game.players.find(p => p.id === player.id);
      if (!live) return;
      live.spellSlots = live.spellSlots || {};
      live.spellSlots[key] = available - 1;
    });

    console.log(`[Engine] Deducted spell slot: ${spell.name} (${key}, remaining: ${available - 1})`);
  }

  /** Apply the HP changes, casualties and new NPCs the model reported. */
  private applyStructuredResult(parsed: StreamResult, playerId: string): void {
    const { creatureHp, playerHp, creatureDefeated, newNPCs } = parsed.structured;

    this.state.mutate(game => {
      if (creatureHp) {
        const creature = game.npcs.find(n => n.name === creatureHp.name);
        if (creature) creature.hp = creatureHp.after;
      }

      if (playerHp) {
        const player = game.players.find(p => p.id === playerId);
        if (player) player.hp = playerHp.after;
      }

      if (creatureDefeated && creatureHp) {
        const index = game.npcs.findIndex(n => n.name === creatureHp.name);
        if (index >= 0) {
          awardXP(game.players, XP_PER_DEFEATED_ENEMY);
          game.npcs.splice(index, 1);
        }
      }

      if (newNPCs) game.npcs.push(...newNPCs);
    });
  }

  // ---- Short rest ----

  /**
   * D&D 5e short rest: spend one hit die to heal, recover some spell slots,
   * and clear death saves. The DM then narrates the breather.
   */
  private async handleShortRest(player: Player, callbacks: LLMCallbacks): Promise<StreamResult> {
    const hitDiceAvailable = (player.hitDice?.total || 0) - (player.hitDice?.used || 0);
    const healed = hitDiceAvailable > 0 ? rollHitDice(player).healed : 0;

    const restSummary = this.state.mutate(game => {
      const live = game.players.find(p => p.id === player.id);
      if (!live) throw new Error("Player not found");

      if (hitDiceAvailable > 0) {
        live.hp = Math.min(live.maxHp, live.hp + healed);
        live.hitDice.used += 1;
      }

      // Recover one slot per level, capped by a simplified per-level maximum.
      for (const [key, value] of Object.entries(live.spellSlots || {})) {
        const maxForLevel = Math.max(2, live.level - parseInt(key.split("-")[1]));
        live.spellSlots[key] = Math.min(maxForLevel, value + 1);
      }

      if (live.hp > 0) {
        live.deathSaves.successes = 0;
        live.deathSaves.failures = 0;
      }

      return getLocalizedMessage(live.locale || "en-US", "event.short_rest")
        .replace("{healed}", healed.toString())
        .replace("{hp}", live.hp.toString())
        .replace("{maxHp}", live.maxHp.toString());
    });

    this.pushChatMessage({
      id: generateId(),
      content: restSummary,
      type: "event",
      timestamp: Date.now(),
    });

    const restPrompt = `The player takes a short rest. Describe the atmosphere — what they hear, smell, and feel while catching their breath after recent events. Keep it brief (1-2 paragraphs). End with JSON block.`;

    const result = await this.llmClient.streamChat(
      this.buildMessages(player, restPrompt),
      callbacks,
      ACTION_STREAM_TIMEOUT_MS
    );
    const parsed = parseLLMResponse(result);

    this.recordExchange(restPrompt, parsed.fullNarrative);

    return {
      fullNarrative: `${restSummary}\n\n${parsed.fullNarrative}`,
      structured: parsed.structured,
    };
  }

  // ---- Opening scene ----

  /** Generate the scene-setting narrative shown when a game starts. */
  async generateOpeningScene(callbacks: LLMCallbacks): Promise<StreamResult> {
    const player = this.game.players[0];
    if (!player) throw new Error("No players in game");

    const scenario = this.scenario();
    const locale = player.locale || "en-US";
    const whatDoYouDo = getLocalizedMessage(locale, "opening.what_do_you_do");

    const openingPrompt = `You are the Dungeon Master. This is the opening scene of a new adventure.

SCENARIO: ${scenarioDescriptions[scenario].label} — ${scenarioDescriptions[scenario].description}

Player "${player.characterName}" (${player.characterClass}, ${player.race}, Lv.${player.level}) has just arrived. Their attributes: Str=${player.attributes.str} Dex=${player.attributes.dex} Con=${player.attributes.con} Int=${player.attributes.int} Wis=${player.attributes.wis} Cha=${player.attributes.cha}.

Describe the opening scene: where the player is, what they see, hear, and feel. Introduce the atmosphere and hint at the adventure ahead. Set the mood. DO NOT ask for an action — just describe the scene and end with "${whatDoYouDo}"

Keep it to 2-4 paragraphs. End with the JSON block.`;

    const messages: LLMMessage[] = [
      { role: "system", content: buildSystemPrompt(scenario, locale) },
      { role: "user", content: this.buildWorldState(player) },
      { role: "assistant", content: "Understood. Here is the opening scene:" },
      { role: "user", content: openingPrompt },
    ];

    // Opening scenes run long, so they get a more generous idle timeout.
    const result = await this.llmClient.streamChat(messages, callbacks, OPENING_STREAM_TIMEOUT_MS);
    const parsed = parseLLMResponse(result);

    this.recordExchange(openingPrompt, parsed.fullNarrative);
    this.pushChatMessage({
      id: generateId(),
      content: parsed.fullNarrative,
      type: "narrative",
      timestamp: Date.now(),
    });

    return parsed;
  }
}
