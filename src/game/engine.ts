import { generateId } from "../utils/id.js";
import { rollDice, calculateTotal, calculateModifier } from "./dice.js";
import { isHit, getDamageDice, calculateAttackDamage, checkCreatureDeath, calculateInitiative, rollHitDice, rollDeathSave, calculatePassiveScore, DC_DIFFICULTY } from "./rules.js";
import { LLMClient, type LLMCallbacks } from "../llm/client.js";
import { buildSystemPrompt, buildActionPrompt } from "../llm/prompts.js";
import { parseLLMResponse } from "../llm/parser.js";
import type { Game, Player, NPC, ChatMessage, PlayerActionPayload, StreamResult } from "../types/index.js";
import { scenarioDescriptions, type Scenario } from "../../shared/schemas/scenario.js";
import { getLocalizedMessage } from "../utils/locale-loader.js";

export class GameEngine {
  private _game: Game;
  private llmClient: LLMClient;
  private _currentInitiativeIndex: number;
  private _round: number;

  constructor(
    gameData: Omit<Game, "createdAt" | "conversationHistory">,
    llmBaseUrl: string,
    llmApiKey: string | null,
    llmModel: string
  ) {
    this._game = {
      ...gameData,
      createdAt: Date.now(),
      conversationHistory: [],
    };
    this.llmClient = new LLMClient(llmBaseUrl, llmApiKey, llmModel);
    this._currentInitiativeIndex = 0;
    this._round = 1;

    // Use the first player's locale for DM narrative language (default: English)
    const creatorLocale = this._game.players?.[0]?.locale || "en-US";
    this._game.conversationHistory.push({
      role: "system",
      content: buildSystemPrompt(this._game.scenario as Scenario || "dungeon", creatorLocale),
    });
  }

  get game(): Game {
    return JSON.parse(JSON.stringify(this._game));
  }

  get id(): string { return this._game.id; }
  get name(): string { return this._game.name; }

  // ---- Initiative ----

  startInitiative(): void {
    const initiative: { playerId?: string; npcId?: string; score: number }[] = [];

    for (const player of this._game.players) {
      initiative.push({ playerId: player.id, score: calculateInitiative(player.attributes.dex) });
    }

    for (const npc of this._game.npcs) {
      initiative.push({ npcId: npc.id, score: calculateInitiative(npc.attributes.dex) });
    }

    initiative.sort((a, b) => b.score - a.score);
    this._game.npcs.forEach((npc, i) => {
      if (initiative[i]?.npcId === npc.id) npc.initiative = initiative[i].score;
    });

    this._currentInitiativeIndex = 0;
    this._round = 1;

    const narrative = `${getLocalizedMessage("en-US", "initiative.rolled")}\n${initiative.map((entry, i) => {
      const name = entry.playerId
        ? this._game.players.find(p => p.id === entry.playerId)?.characterName
        : this._game.npcs.find(n => n.id === entry.npcId)?.name;
      return `${i + 1}. ${name || "Unknown"} (${entry.score})`;
    }).join("\n")}`;

    this._game.conversationHistory.push({ role: "assistant", content: narrative });
  }

  getCurrentPlayer(): Player | undefined {
    const allEntities: (NPC | Player)[] = this._game.npcs.length > 0
      ? [...this._game.npcs, ...this._game.players].sort((a, b) => (b as any).initiative! - (a as any).initiative!)
      : this._game.players as unknown as (NPC | Player)[];
    return allEntities[this._currentInitiativeIndex % allEntities.length] as Player | undefined;
  }

  advanceTurn(): void {
    const allEntities: (NPC | Player)[] = this._game.npcs.length > 0
      ? [...this._game.npcs, ...this._game.players].sort((a, b) => (b as any).initiative! - (a as any).initiative!)
      : this._game.players as unknown as (NPC | Player)[];
    this._currentInitiativeIndex = (this._currentInitiativeIndex + 1) % allEntities.length;
    if (this._currentInitiativeIndex === 0) this._round++;
  }

  // ---- Player Action ----

  async handlePlayerAction(
    payload: PlayerActionPayload,
    playerId: string,
    callbacks: LLMCallbacks
  ): Promise<StreamResult> {
    const player = this._game.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");

    // ---- Handle special D&D 5e actions before LLM processing ----
    const actionLower = payload.action.toLowerCase();

    // Short rest: roll hit dice for healing, recover spell slots & hit dice
    if (actionLower.includes("short rest") || actionLower.includes("rest")) {
      return this.handleShortRest(player, playerId, callbacks);
    }

    // Use potion of healing
    if (actionLower.includes("drink potion") || actionLower.includes("use potion") || actionLower.includes("potion of healing")) {
      const hitDiceRoll = rollHitDice(player);
      const healed = hitDiceRoll.healed;
      player.hp = Math.min(player.maxHp, player.hp + healed);

      const narrativeMsg: ChatMessage = {
        id: generateId(),
        content: getLocalizedMessage(player.locale || "en-US", "event.potion_healing")
          .replace("{healed}", healed.toString())
          .replace("{hp}", player.hp.toString())
          .replace("{maxHp}", player.maxHp.toString()),
        type: "event",
        timestamp: Date.now(),
      };
      this._game.chatHistory.push(narrativeMsg);

      // Still send to LLM for atmospheric response
    }

    let target: NPC | undefined;
    if (payload.target) {
      const targetName = payload.target as string;
      target = this._game.npcs.find(n => n.name.toLowerCase().includes(targetName.toLowerCase()));
    }

    let diceResult = undefined;
    if (payload.dice) {
      const rolls = rollDice(payload.dice.type, payload.dice.count);
      diceResult = {
        id: generateId(),
        playerId,
        playerName: player.name,
        characterName: player.characterName,
        diceType: payload.dice.type,
        count: payload.dice.count,
        rolls,
        modifier: payload.dice.modifier || 0,
        total: calculateTotal(rolls, payload.dice.modifier || 0),
        isHit: false,
        timestamp: Date.now(),
      };

      const hitCheck = target ? isHit(diceResult.total, player, target, 0) : { hit: true, isCritical: false };
      diceResult.isHit = hitCheck.hit;
    }

    const combatStatus = this._game.npcs.length > 0
      ? `Combat active. ${this._game.npcs.length} NPC(s) present. Round ${this._round}.`
      : `No active combat.`;

    // Calculate passive scores for DM reference
    const passivePerception = calculatePassiveScore(player, "Perception");
    const passiveInsight = calculatePassiveScore(player, "Insight");
    const hitDiceAvailable = (player.hitDice?.total || 0) - (player.hitDice?.used || 0);

    // Extend combat status with D&D 5e mechanics info
    const extendedStatus = `${combatStatus} Passive Perception: ${passivePerception}. Hit Dice available: ${hitDiceAvailable}/${player.hitDice?.total || 0}. Death saves: ${player.deathSaves?.successes || 0} successes, ${player.deathSaves?.failures || 0} failures.`;

    // Build the action context (stats, dice, combat status, etc.) — NO conversation history here
    const actionContext = buildActionPrompt(payload.action, {
      currentPlayer: player,
      target,
      diceResult,
      combatStatus: extendedStatus,
      conversationHistory: [], // History is sent as separate messages below
      scenario: this._game.scenario as Scenario || "dungeon",
      locale: player.locale || "en-US",
    });

    // Deduct spell slot if player is using a known spell
    const usedSpell = player.spells?.find(
      s => actionContext.toLowerCase().includes(s.name.toLowerCase())
    );

    if (usedSpell) {
      const key = `level-${usedSpell.level}`;
      const currentSlots = player.spellSlots[key] || 0;

      if (currentSlots > 0) {
        // Deduct one slot from this player's spell slots
        const playerIdx = this._game.players.findIndex(p => p.id === playerId);
        if (playerIdx >= 0) {
          if (!this._game.players[playerIdx].spellSlots) {
            this._game.players[playerIdx].spellSlots = {};
          }
          this._game.players[playerIdx].spellSlots[key] = currentSlots - 1;

          console.log(`[Engine] Deducted spell slot: ${usedSpell.name} (level-${usedSpell.level}, remaining: ${currentSlots - 1})`);
        }
      } else {
        // No slots left — LLM will narrate the failure naturally
        console.log(`[Engine] No slots for spell: ${usedSpell.name}`);
      }
    }

    // Build messages: system prompt + conversation history + current action
    // This gives the LLM full context of previous turns so the story progresses naturally
    const systemPrompt = buildSystemPrompt(this._game.scenario as Scenario, player.locale || "en-US");
    const maxHistoryTurns = 8; // Keep last 8 turns (16 messages) for context
    const historyStartIdx = Math.max(1, this._game.conversationHistory.length - (maxHistoryTurns * 2));

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      // Include conversation history as proper message pairs (skip index 0 = system message)
      ...this._game.conversationHistory.slice(historyStartIdx).map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      // Current player action as the final user message
      { role: "user", content: actionContext },
    ];

    const result = await this.llmClient.streamChat(messages, callbacks, 60000);

    const parsed = parseLLMResponse(result);

    this._game.conversationHistory.push({ role: "user", content: actionContext });
    this._game.conversationHistory.push({ role: "assistant", content: parsed.fullNarrative });

    // Trim old history to control token usage, but always keep the system message (index 0)
    const maxHistoryLength = 30; // ~15 turns of conversation
    if (this._game.conversationHistory.length > maxHistoryLength) {
      this._game.conversationHistory = [
        this._game.conversationHistory[0], // Keep system message
        ...this._game.conversationHistory.slice(-(maxHistoryLength - 1)),
      ];
    }

    if (parsed.structured.creatureHp) {
      const creature = this._game.npcs.find(n => n.name === parsed.structured.creatureHp!.name);
      if (creature) {
        creature.hp = parsed.structured.creatureHp.after;
      }
    }

    if (parsed.structured.playerHp) {
      const pl = this._game.players.find(p => p.id === playerId);
      if (pl) {
        pl.hp = parsed.structured.playerHp.after;
      }
    }

    if (parsed.structured.creatureDefeated && parsed.structured.creatureHp) {
      const idx = this._game.npcs.findIndex(n => n.name === parsed.structured.creatureHp!.name);
      if (idx >= 0) {
        this._game.npcs.splice(idx, 1);
      }
    }

    if (parsed.structured.newNPCs) {
      this._game.npcs.push(...parsed.structured.newNPCs);
    }

    this.advanceTurn();

    const narrativeMsg: ChatMessage = {
      id: generateId(),
      content: parsed.fullNarrative,
      type: "narrative",
      timestamp: Date.now(),
    };
    this._game.chatHistory.push(narrativeMsg);
    if (this._game.chatHistory.length > 100) this._game.chatHistory.shift();

    return parsed;
  }

  // ---- Short Rest (D&D 5e) ----

  private async handleShortRest(player: Player, playerId: string, callbacks: LLMCallbacks): Promise<StreamResult> {
    const playerIdx = this._game.players.findIndex(p => p.id === playerId);
    if (playerIdx < 0) throw new Error("Player not found");

    // Roll hit dice for healing (roll 1dHD + CON mod, up to level times)
    const hdAvailable = (player.hitDice?.total || 0) - (player.hitDice?.used || 0);
    let totalHealed = 0;

    if (hdAvailable > 0) {
      // Roll one hit die for short rest healing
      const healResult = rollHitDice(player);
      totalHealed = healResult.healed;
      player.hp = Math.min(player.maxHp, player.hp + totalHealed);
      this._game.players[playerIdx].hitDice!.used += 1;
    }

    // Recover spell slots (half of max slots recovered on short rest)
    if (player.spellSlots) {
      for (const [key, val] of Object.entries(player.spellSlots)) {
        const maxForLevel = Math.max(2, player.level - parseInt(key.split("-")[1])); // Simplified max slot calculation
        this._game.players[playerIdx].spellSlots[key] = Math.min(maxForLevel, val + 1);
      }
    }

    // Reset death saves if HP > 0 after rest
    if (player.hp > 0) {
      player.deathSaves.successes = 0;
      player.deathSaves.failures = 0;
    }

    const narrativeMsg: ChatMessage = {
      id: generateId(),
      content: getLocalizedMessage(player.locale || "en-US", "event.short_rest")
        .replace("{healed}", totalHealed.toString())
        .replace("{hp}", player.hp.toString())
        .replace("{maxHp}", player.maxHp.toString()),
      type: "event",
      timestamp: Date.now(),
    };
    this._game.chatHistory.push(narrativeMsg);

    // Send atmospheric response from DM — include conversation history for continuity
    const restPrompt = `The player takes a short rest. Describe the atmosphere — what they hear, smell, and feel while catching their breath after recent events. Keep it brief (1-2 paragraphs). End with JSON block.`;

    const maxHistoryTurns = 8;
    const historyStartIdx = Math.max(1, this._game.conversationHistory.length - (maxHistoryTurns * 2));
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: buildSystemPrompt(this._game.scenario as Scenario, player.locale || "en-US") },
      ...this._game.conversationHistory.slice(historyStartIdx).map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: restPrompt },
    ];

    const result = await this.llmClient.streamChat(messages, callbacks, 60000);
    const parsed = parseLLMResponse(result);

    this._game.conversationHistory.push({ role: "user", content: restPrompt });
    this._game.conversationHistory.push({ role: "assistant", content: parsed.fullNarrative });

    return {
      fullNarrative: `${narrativeMsg.content}\n\n${parsed.fullNarrative}`,
      structured: parsed.structured,
    };
  }

  // ---- Opening Scene ----

  async generateOpeningScene(
    callbacks: LLMCallbacks
  ): Promise<StreamResult> {
    const player = this._game.players[0];
    if (!player) throw new Error("No players in game");

    const scenario = (this._game.scenario as Scenario) || "dungeon";

    const locale = player.locale || "en-US";
    const whatDoYouDo = getLocalizedMessage(locale, "opening.what_do_you_do");
    const openingPrompt = `You are the Dungeon Master. This is the opening scene of a new adventure.

SCENARIO: ${scenarioDescriptions[scenario].label} — ${scenarioDescriptions[scenario].description}

Player "${player.characterName}" (${player.characterClass}, ${player.race}, Lv.${player.level}) has just arrived. Their attributes: Str=${player.attributes.str} Dex=${player.attributes.dex} Con=${player.attributes.con} Int=${player.attributes.int} Wis=${player.attributes.wis} Cha=${player.attributes.cha}.

Describe the opening scene: where the player is, what they see, hear, and feel. Introduce the atmosphere and hint at the adventure ahead. Set the mood. DO NOT ask for an action — just describe the scene and end with "${whatDoYouDo}"

Keep it to 2-4 paragraphs. End with the JSON block.`;

    const messages = [
      { role: "system" as const, content: buildSystemPrompt(scenario, player.locale || "en-US") },
      { role: "user" as const, content: openingPrompt },
    ];

    // Use 90s idle timeout - opening scenes can be long with structured JSON output
    const result = await this.llmClient.streamChat(messages, callbacks, 90000);

    const parsed = parseLLMResponse(result);

    // Update state after stream completes (onEnd already fired but we need complete state)
    this._game.conversationHistory.push({ role: "user", content: openingPrompt });
    this._game.conversationHistory.push({ role: "assistant", content: parsed.fullNarrative });

    const narrativeMsg: ChatMessage = {
      id: generateId(),
      content: parsed.fullNarrative,
      type: "narrative",
      timestamp: Date.now(),
    };
    this._game.chatHistory.push(narrativeMsg);
    if (this._game.chatHistory.length > 100) this._game.chatHistory.shift();

    return parsed;
  }

  // ---- Chat ----

  addChatMessage(playerId: string, content: string): void {
    const player = this._game.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");

    const message: ChatMessage = {
      id: generateId(),
      playerId,
      playerName: player.name,
      characterName: player.characterName,
      content,
      type: "text",
      timestamp: Date.now(),
    };
    this._game.chatHistory.push(message);
    if (this._game.chatHistory.length > 100) this._game.chatHistory.shift();
  }

  // ---- NPC Creation ----

  addNPC(name: string, description: string, role: "friendly" | "neutral" | "hostile"): void {
    const npc: NPC = {
      id: generateId(),
      name,
      description,
      role,
      hp: 10,
      maxHp: 10,
      ac: 11,
      attributes: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      createdAt: Date.now(),
    };
    this._game.npcs.push(npc);
  }

  // ---- Event ----

  addEvent(title: string, description: string): void {
    const msg: ChatMessage = {
      id: generateId(),
      content: `Event: ${title} — ${description}`,
      type: "event",
      timestamp: Date.now(),
    };
    this._game.chatHistory.push(msg);
  }

  getPlayerCount(): number { return this._game.players.length; }
  getMaxPlayers(): number { return this._game.maxPlayers; }
  getCreatedAt(): number { return this._game.createdAt; }

  addPlayer(player: Player): void {
    this._game.players.push(player);
  }
}
