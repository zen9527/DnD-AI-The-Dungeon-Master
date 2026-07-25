import { generateId } from "../utils/id.js";
import { rollDice, calculateTotal, calculateModifier, calculateProficiencyBonus } from "./dice.js";
import { isHit, calculateInitiative, rollHitDice, DC_DIFFICULTY, getActionSkillCheck, CLASS_SKILL_PROFICIENCIES, calculateCombinedCheck, awardXP, buildInitiativeOrder, checkLevelUp } from "./rules.js";
import { LLMClient, type LLMCallbacks } from "../llm/client.js";
import { buildSystemPrompt, buildActionPrompt } from "../llm/prompts.js";
import { parseLLMResponse } from "../llm/parser.js";
import type { Game, Player, NPC, ChatMessage, PlayerActionPayload, StreamResult, InitiativeEntry, Item } from "../types/index.js";
import { scenarioDescriptions, type Scenario } from "../../shared/schemas/scenario.js";
import { HIT_DIE_BY_CLASS } from "../../shared/schemas/game.js";
import { LOCALE_LLM_NAME } from "../../shared/schemas/locale.js";
import { getLocalizedMessage } from "../utils/locale-loader.js";
import * as storage from "../utils/storage.js";

export class GameEngine {
  private _game: Game;
  private llmClient: LLMClient;
  private _currentInitiativeIndex: number;
  private _round: number;
  private _currentTurnIndex: number;

  // Story summary: rolling digest of key events for long-term memory
  // Updated every few turns to keep the DM aware of the big picture
  private _storySummary: string = "";
  private _turnCount: number = 0;
  private readonly SUMMARY_INTERVAL = 5; // Update summary every N turns

  // Turn timer (seconds remaining for current player)
  private _timerRemaining: number = 60;
  private _timerInterval: NodeJS.Timeout | null = null;
  private _timerExpired: boolean = false;
  private readonly DEFAULT_TIMER = 60; // Increased from 30 to 60 seconds

  // Cached game snapshot — invalidated on mutation to avoid repeated deep-copy on every read
  private _snapshot: Game | null = null;

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
      // Initialize combat state if not present
      combatMode: gameData.combatMode ?? false,
      initiativeOrder: gameData.initiativeOrder ?? [],
      currentRound: gameData.currentRound ?? 1,
      currentTurnIndex: gameData.currentTurnIndex ?? 0,
    };
    this.llmClient = new LLMClient(llmBaseUrl, llmApiKey, llmModel);
    this._currentInitiativeIndex = 0;
    this._round = this._game.currentRound;
    this._currentTurnIndex = this._game.currentTurnIndex;

    // Use the first player's locale for DM narrative language (default: English)
    const creatorLocale = this._game.players?.[0]?.locale || "en-US";
    this._game.conversationHistory.push({
      role: "system",
      content: buildSystemPrompt(this._game.scenario as Scenario || "dungeon", creatorLocale),
    });
  }

  get game(): Game {
    if (this._snapshot) return this._snapshot;
    return this._snapshot = JSON.parse(JSON.stringify(this._game));
  }

  /** Invalidate the cached snapshot — call after any mutation to _game */
  private invalidateSnapshot(): void {
    this._snapshot = null;
  }

  get id(): string { return this._game.id; }
  get name(): string { return this._game.name; }
  get timerRemaining(): number { return this._timerRemaining; }
  get timerExpired(): boolean { return this._timerExpired || false; }
  get combatMode(): boolean { return this._game.combatMode; }
  /** Get initiative order (untyped array for compatibility) */
  get initiativeOrder(): InitiativeEntry[] { return this._game.initiativeOrder; }
  /** Get current combat round number */
  get currentRound(): number { return this._game.currentRound; }
  /** Get current turn index in initiative order */
  get currentTurnIndex(): number { return this._game.currentTurnIndex; }

  startTimer(): void {
    if (this._timerInterval) clearInterval(this._timerInterval);
    
    this._timerRemaining = this.DEFAULT_TIMER;
    this._timerExpired = false; // Reset expiration flag
    
    this._timerInterval = setInterval(() => {
      if (this._timerRemaining > 0) {
        this._timerRemaining--;
      }
      if (this._timerRemaining <= 0) {
        this._timerRemaining = 0;
        this._timerExpired = true;
        console.log(`[Timer] Turn timer expired for ${this.getCurrentPlayer()?.characterName}`);
      }
    }, 1000);
    
    // Broadcast timer state every 5 seconds
    // Note: Engine doesn't have WebSocketManager reference, so it can't broadcast directly
    // The WebSocketManager polls the engine's timer state and broadcasts to clients
    // See manager.ts for timerBroadcastIntervals Map that handles periodic broadcasts
  }

  stopTimer(): void {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  // ---- Initiative & Combat ----

  private getPlayerLocale(): string {
    return this._game.players?.[0]?.locale || "en-US";
  }

  startCombat(startInitiative: boolean = true): void {
    // Enable combat mode
    this._game.combatMode = true;
    
    // Roll initiative if requested
    if (startInitiative) {
      const initiativeOrder = buildInitiativeOrder(this._game.players, this._game.npcs);
      
      // Apply initiative scores to players and NPCs
      for (const entry of initiativeOrder) {
        if (entry.playerId) {
          const player = this._game.players.find(p => p.id === entry.playerId);
          if (player) player.initiative = entry.score;
        } else if (entry.npcId) {
          const npc = this._game.npcs.find(n => n.id === entry.npcId);
          if (npc) npc.initiative = entry.score;
        }
      }
      
      // Build initiative order with full entity info
      this._game.initiativeOrder = initiativeOrder.map(entry => {
        const isPlayer = !!entry.playerId;
        const entity = isPlayer 
          ? this._game.players.find(p => p.id === entry.playerId)
          : this._game.npcs.find(n => n.id === entry.npcId);
        
        return {
          playerId: entry.playerId,
          npcId: entry.npcId,
          score: entry.score,
          name: isPlayer 
            ? (entity as Player)?.characterName || "Unknown Player"
            : (entity as NPC)?.name || "Unknown NPC",
          hp: entity?.hp || 0,
          maxHp: entity?.maxHp || 0,
          ac: entity?.ac || 10,
          isPlayer,
        };
      });
      
      this._currentInitiativeIndex = 0;
      this._round = 1;
      this._game.currentRound = 1;
      this._game.currentTurnIndex = 0;

    const narrative = `${getLocalizedMessage(this.getPlayerLocale(), "initiative.rolled")}\n${this._game.initiativeOrder.map((entry, i) => {
      return `${i + 1}. ${entry.name} (${entry.score})`;
    }).join("\n")}`;

    this._game.conversationHistory.push({ role: "assistant", content: narrative });
    } else {
      // Just enable combat mode without rolling initiative
      this._game.initiativeOrder = [];
      this._currentInitiativeIndex = 0;
      this._round = 1;
      this._game.currentRound = 1;
      this._game.currentTurnIndex = 0;
    }

    this.invalidateSnapshot();
  }

  endCombat(): void {
    this._game.combatMode = false;
    // Clear initiative scores but keep NPC data
    this._game.players.forEach(p => delete p.initiative);
    this._game.initiativeOrder = [];
    this._currentInitiativeIndex = 0;
    this._round = 1;
    this._game.currentRound = 1;
    this._game.currentTurnIndex = 0;
    
    const narrative = getLocalizedMessage(this.getPlayerLocale(), "combat.ended");
    this._game.conversationHistory.push({ role: "assistant", content: narrative });

    this.invalidateSnapshot();
  }

  rollIndividualInitiative(entityId: string, isPlayer: boolean): number {
    const score = calculateInitiative(
      isPlayer 
        ? this._game.players.find(p => p.id === entityId)?.attributes.dex || 10
        : this._game.npcs.find(n => n.id === entityId)?.attributes.dex || 10
    );
    
    // Add to initiative order
    const entity = isPlayer
      ? this._game.players.find(p => p.id === entityId)
      : this._game.npcs.find(n => n.id === entityId);
    
    if (entity) {
      const entry = {
        playerId: isPlayer ? entityId : undefined,
        npcId: !isPlayer ? entityId : undefined,
        score,
        name: isPlayer 
          ? (entity as Player).characterName 
          : (entity as NPC).name,
        hp: entity.hp,
        maxHp: entity.maxHp,
        ac: entity.ac,
        isPlayer,
      };
      
      this._game.initiativeOrder.push(entry);
      this._game.initiativeOrder.sort((a, b) => b.score - a.score);
      
      // Update entity's initiative score
      if (isPlayer) {
        const player = this._game.players.find(p => p.id === entityId);
        if (player) player.initiative = score;
      } else {
        const npc = this._game.npcs.find(n => n.id === entityId);
        if (npc) npc.initiative = score;
      }
    }
    
    return score;
  }

  advanceTurn(): void {
    if (!this._game.combatMode || this._game.initiativeOrder.length === 0) {
      // Non-combat turn advancement
      const allEntities: (NPC | Player)[] = this._game.npcs.length > 0
        ? [...this._game.npcs, ...this._game.players].sort((a, b) => (b as any).initiative! - (a as any).initiative!)
        : this._game.players as unknown as (NPC | Player)[];
      this._currentInitiativeIndex = (this._currentInitiativeIndex + 1) % allEntities.length;
      if (this._currentInitiativeIndex === 0) this._round++;
    } else {
      // Combat turn advancement
      this._currentTurnIndex = (this._currentTurnIndex + 1) % this._game.initiativeOrder.length;
      this._game.currentTurnIndex = this._currentTurnIndex;
      
      if (this._currentTurnIndex === 0) {
        this._round++;
        this._game.currentRound = this._round;
      }
    }
    
    // Reset timer for new player
    this.startTimer();
  }

  getCurrentPlayer(): Player | undefined {
    if (!this._game.combatMode || this._game.initiativeOrder.length === 0) {
      // Non-combat: just return next player in rotation
      const allEntities: (NPC | Player)[] = this._game.npcs.length > 0
        ? [...this._game.npcs, ...this._game.players].sort((a, b) => (b as any).initiative! - (a as any).initiative!)
        : this._game.players as unknown as (NPC | Player)[];
      return allEntities[this._currentInitiativeIndex % allEntities.length] as Player | undefined;
    } else {
      // Combat: follow initiative order
      const currentEntry = this._game.initiativeOrder[this._currentTurnIndex];
      if (!currentEntry?.playerId) return undefined;
      return this._game.players.find(p => p.id === currentEntry.playerId);
    }
  }

  getCurrentCombatEntity(): { name: string; hp: number; maxHp: number; ac: number; isPlayer: boolean } | undefined {
    if (!this._game.combatMode || this._game.initiativeOrder.length === 0) return undefined;
    return this._game.initiativeOrder[this._currentTurnIndex];
  }

  updateNPCHP(npcId: string, newHp: number): void {
    const npc = this._game.npcs.find(n => n.id === npcId);
    if (npc) {
      npc.hp = Math.max(0, newHp);
      
      // Update initiative order if combat is active
      const entry = this._game.initiativeOrder.find(e => e.npcId === npcId);
      if (entry) {
        entry.hp = npc.hp;
        entry.maxHp = npc.maxHp;
      }
    }
  }

  // ---- World State (compact game state for LLM context) ----

  /**
   * Build a compact world state string (~100 tokens) that gives the DM
   * current game state without repeating full player stats every turn.
   */
  private buildWorldState(player: Player): string {
    const npcLines = this._game.npcs.map(n =>
      `  - ${n.name}: HP ${n.hp}/${n.maxHp} AC ${n.ac} [${n.role}]`
    );
    const npcSection = this._game.npcs.length > 0
      ? `NPCs present:\n${npcLines.join('\n')}`
      : "NPCs present: none";

    return `WORLD STATE:
Player: ${player.characterName} HP ${player.hp}/${player.maxHp} AC ${player.ac}
${npcSection}
Combat: ${this._game.npcs.length > 0 ? `Active - Round ${this._round}` : "None"}`;
  }

  // ---- Story Summary (long-term memory) ----

  /**
   * Update the story summary by asking LLM to condense recent events.
   * This gives the DM a "big picture" understanding of the adventure.
   * Called every SUMMARY_INTERVAL turns.
   */
  private async updateStorySummary(player: Player): Promise<void> {
    // Get recent conversation for summarization
    const recentHistory = this._game.conversationHistory.slice(-10);
    const historyText = recentHistory.map(m => `[${m.role}]: ${m.content.substring(0, 300)}`).join('\n');

    const locale = player.locale || "en-US";
    const language = LOCALE_LLM_NAME[locale as keyof typeof LOCALE_LLM_NAME] || "English";

    const summaryPrompt = `You are summarizing a D&D adventure for the Dungeon Master's reference.
${this._storySummary ? `CURRENT SUMMARY:\n${this._storySummary}\n\n` : ""}RECENT EVENTS:\n${historyText}

Write a concise adventure summary in ${language} (max 200 words). Include:
- Key locations visited and current location
- Important NPCs met (allies, enemies, their status)
- Major decisions and their consequences
- Current objectives or threats

Format as bullet points. Keep it factual, not narrative.`;

    try {
      const summaryMessages = [
        { role: "system" as const, content: `You are a D&D adventure summarizer. Respond in ${language}. Be concise.` },
        { role: "user" as const, content: summaryPrompt },
      ];
      const summaryResult = await this.llmClient.streamChat(summaryMessages, {
        onChunk: () => {}, // Silent - don't stream summary updates to client
        onEnd: (content) => {
          this._storySummary = content.trim();
          console.log(`[Engine] Story summary updated (${content.length} chars)`);
        },
        onError: (err) => {
          console.warn(`[Engine] Story summary update failed: ${err.message}`);
        },
      }, 30000);
      // Fallback: if streamChat returns content, use it
      if (summaryResult && !this._storySummary) {
        this._storySummary = summaryResult.trim();
      }
    } catch {
      // Summary update is best-effort, don't fail the turn
      console.warn(`[Engine] Story summary update skipped`);
    }
  }

  // ---- Player Action ----

  /**
   * Handle player action and trigger LLM streaming for DM response.
   * Sends action to chat history, then streams LLM narrative with structured result.
   */
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

    // ---- Auto-detect action and roll appropriate dice for preset actions ----
    if (!diceResult) {
      const skillCheck = getActionSkillCheck(payload.action);

      if (skillCheck && skillCheck.dc > 0) {
        // Auto-roll the skill check
        const d20Rolls = rollDice(20, 1);
        const d20Total = calculateTotal(d20Rolls, 0);
        
        // Calculate modifier: ability mod + proficiency bonus (if skilled)
        const abilityMod = calculateModifier(player.attributes[skillCheck.ability]);
        const isSkilled = CLASS_SKILL_PROFICIENCIES[player.characterClass]?.includes(skillCheck.skill);
        const proficiency = isSkilled ? calculateProficiencyBonus(player.level) : 0;
        const mainModifier = abilityMod + proficiency;

        // Check if other players are helping
        const helpers = payload.helpers?.length || 0;

        let finalTotal: number;
        let helperBonus: number = 0;

        if (helpers > 0) {
          // Combined check with helpers (+2 per proficient helper)
          const combinedResult = calculateCombinedCheck(d20Total, mainModifier, helpers);
          finalTotal = combinedResult.total;
          helperBonus = combinedResult.helperBonus;
        } else {
          // Regular single-player check
          finalTotal = d20Total + mainModifier;
        }

        diceResult = {
          id: generateId(),
          playerId,
          playerName: player.name,
          characterName: player.characterName,
          diceType: 20,
          count: 1,
          rolls: d20Rolls,
          modifier: mainModifier + helperBonus,
          total: finalTotal,
          isHit: finalTotal >= skillCheck.dc,
          timestamp: Date.now(),
          skillCheck: {
            skill: skillCheck.skill,
            dc: skillCheck.dc,
            success: finalTotal >= skillCheck.dc,
            helpers: helpers
          } as any
        };

        if (helpers > 0) {
          console.log(`[CombinedCheck] ${skillCheck.skill}: ${finalTotal} vs DC ${skillCheck.dc} with ${helpers} helpers (+${helperBonus})`);
        } else {
          console.log(`[AutoRoll] ${skillCheck.skill} check: ${finalTotal} vs DC ${skillCheck.dc} = ${finalTotal >= skillCheck.dc ? "SUCCESS" : "FAILURE"}`);
        }
      }
    }

    const combatStatus = this._game.npcs.length > 0
      ? `Combat active. ${this._game.npcs.length} NPC(s) present. Round ${this._round}.`
      : `No active combat.`;

    // Build the action context — lightweight, no player stats (they're in world state)
    const actionContext = buildActionPrompt(payload.action, {
      currentPlayer: player,
      target,
      diceResult,
      combatStatus,
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

    // Build messages: system + story summary + world state + recent history + action
    // Story summary gives long-term memory, recent history gives short-term context
    const systemPrompt = buildSystemPrompt(this._game.scenario as Scenario, player.locale || "en-US");
    const worldState = this.buildWorldState(player);
    const maxHistoryTurns = 4; // Only 4 recent turns needed — summary covers the rest
    const historyStartIdx = Math.max(1, this._game.conversationHistory.length - (maxHistoryTurns * 2));

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Story summary: gives DM the "big picture" of the adventure
    if (this._storySummary) {
      messages.push({
        role: "user",
        content: `ADVENTURE SUMMARY (key events so far):\n${this._storySummary}`,
      });
      messages.push({
        role: "assistant",
        content: "Understood. I'll keep this context in mind as the adventure continues.",
      });
    }

    // World state: compact current game state
    messages.push({
      role: "user",
      content: worldState,
    });

    // Recent conversation history (last 4 turns)
    const recentHistory = this._game.conversationHistory.slice(historyStartIdx);
    if (recentHistory.length > 0) {
      messages.push(...recentHistory.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })));
    }

    // Current player action as the final user message
    messages.push({ role: "user", content: actionContext });

    const result = await this.llmClient.streamChat(messages, callbacks, 60000);

    const parsed = parseLLMResponse(result);

    this._game.conversationHistory.push({ role: "user", content: actionContext });
    this._game.conversationHistory.push({ role: "assistant", content: parsed.fullNarrative });

    // Trim old history to control token usage, but always keep the system message (index 0)
    const maxHistoryLength = 20; // ~10 turns stored in memory
    if (this._game.conversationHistory.length > maxHistoryLength) {
      this._game.conversationHistory = [
        this._game.conversationHistory[0], // Keep system message
        ...this._game.conversationHistory.slice(-(maxHistoryLength - 1)),
      ];
    }

    // Update story summary periodically (every SUMMARY_INTERVAL turns)
    this._turnCount++;
    if (this._turnCount >= this.SUMMARY_INTERVAL) {
      this._turnCount = 0;
      // Update summary in background (don't await — don't block the response)
      this.updateStorySummary(player).catch(() => {});
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
        // Award XP for defeating enemy
        const xpPerEnemy = 50; // Simplified - should be based on CR later
        awardXP(this._game.players, xpPerEnemy);
        
        this._game.npcs.splice(idx, 1);
      }
    }

    if (parsed.structured.newNPCs) {
      this._game.npcs.push(...parsed.structured.newNPCs);
    }

    // Include auto-rolled dice result in the response
    if (diceResult) {
      parsed.structured.diceResult = diceResult;
      
      // Also add a chat message with the dice result for display
      const diceMsg: ChatMessage = {
        id: generateId(),
        playerId,
        playerName: player.name,
        characterName: player.characterName,
        content: "", // Empty content, dice result will be shown separately
        type: "roll",
        timestamp: Date.now(),
        diceResult: diceResult
      };
      this._game.chatHistory.push(diceMsg);
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

    this.invalidateSnapshot();
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

    // Send atmospheric response from DM — include story summary + recent history
    const restPrompt = `The player takes a short rest. Describe the atmosphere — what they hear, smell, and feel while catching their breath after recent events. Keep it brief (1-2 paragraphs). End with JSON block.`;

    const maxHistoryTurns = 4;
    const historyStartIdx = Math.max(1, this._game.conversationHistory.length - (maxHistoryTurns * 2));
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: buildSystemPrompt(this._game.scenario as Scenario, player.locale || "en-US") },
    ];

    if (this._storySummary) {
      messages.push({ role: "user", content: `ADVENTURE SUMMARY:\n${this._storySummary}` });
      messages.push({ role: "assistant", content: "Understood." });
    }

    messages.push({ role: "user", content: this.buildWorldState(player) });
    messages.push(...this._game.conversationHistory.slice(historyStartIdx).map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })));
    messages.push({ role: "user", content: restPrompt });

    const result = await this.llmClient.streamChat(messages, callbacks, 60000);
    const parsed = parseLLMResponse(result);

    this._game.conversationHistory.push({ role: "user", content: restPrompt });
    this._game.conversationHistory.push({ role: "assistant", content: parsed.fullNarrative });

    this.invalidateSnapshot();
    return {
      fullNarrative: `${narrativeMsg.content}\n\n${parsed.fullNarrative}`,
      structured: parsed.structured,
    };
  }

  // ---- Opening Scene ----

  /**
   * Generate the opening scene for a new game or player joining.
   * Creates immersive narrative context via LLM streaming.
   */
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
      { role: "user" as const, content: this.buildWorldState(player) },
      { role: "assistant" as const, content: "Understood. Here is the opening scene:" },
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

    this.invalidateSnapshot();
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
      conditions: [],
      buffs: [],
    };
    this._game.npcs.push(npc);
  }

  // ---- DM NPC Control (Enhanced) ----

  /**
   * Create NPC with full stats (DM-only control)
   */
  createNPC(npcData: {
    name: string;
    description?: string;
    role: "friendly" | "neutral" | "hostile";
    hp: number;
    maxHp: number;
    ac: number;
    attributes: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  }): void {
    const npc: NPC = {
      id: generateId(),
      name: npcData.name,
      description: npcData.description || "",
      role: npcData.role,
      hp: Math.max(0, npcData.hp),
      maxHp: Math.max(0, npcData.maxHp),
      ac: Math.max(0, npcData.ac),
      attributes: npcData.attributes,
      createdAt: Date.now(),
      conditions: [],
      buffs: [],
    };
    this._game.npcs.push(npc);
  }

  /**
   * Apply condition to NPC (DM-only)
   */
  applyConditionToNPC(npcId: string, condition: string): void {
    const npc = this._game.npcs.find(n => n.id === npcId);
    if (npc) {
      // Prevent duplicates
      if (!npc.conditions.includes(condition)) {
        npc.conditions.push(condition);
      }
    }
  }

  /**
   * Remove condition from NPC (DM-only)
   */
  removeConditionFromNPC(npcId: string, condition: string): void {
    const npc = this._game.npcs.find(n => n.id === npcId);
    if (npc) {
      npc.conditions = npc.conditions.filter(c => c !== condition);
    }
  }

  /**
   * Delete NPC from game (DM-only)
   */
  deleteNPC(npcId: string): void {
    const idx = this._game.npcs.findIndex(n => n.id === npcId);
    if (idx >= 0) {
      this._game.npcs.splice(idx, 1);
      
      // Remove from initiative order if combat is active
      const initiativeIdx = this._game.initiativeOrder.findIndex(e => e.npcId === npcId);
      if (initiativeIdx >= 0) {
        this._game.initiativeOrder.splice(initiativeIdx, 1);
      }
    }
  }

  /**
   * Get all NPCs in game
   */
  getAllNPCs(): NPC[] {
    return JSON.parse(JSON.stringify(this._game.npcs));
  }

  // ---- DM XP & Level Control ----

   /**
    * Award XP to a specific player (DM-only)
    */
   awardXPToPlayer(playerId: string, amount: number): void {
     const player = this._game.players.find(p => p.id === playerId);
     if (player) {
       player.xp += amount;
       
       // Check for level up using proper D&D 5e XP thresholds
       const { shouldLevelUp } = checkLevelUp(player.xp, player.level);
       if (shouldLevelUp) {
         this.levelUpPlayer(playerId);
       }
     }
   }

   /**
    * Award XP to all players (DM-only)
    */
   awardXPToAllPlayers(amount: number): void {
     this._game.players.forEach(player => {
       player.xp += amount;
       
       // Check for level up using proper D&D 5e XP thresholds
       const { shouldLevelUp } = checkLevelUp(player.xp, player.level);
       if (shouldLevelUp) {
         this.levelUpPlayer(player.id);
       }
     });
   }

   /**
    * Level up a player (DM-only)
    */
   levelUpPlayer(playerId: string): void {
     const player = this._game.players.find(p => p.id === playerId);
     if (player) {
       player.level++;

       // Increase max HP (average of hit die + CON mod)
       const hitDie = HIT_DIE_BY_CLASS[player.characterClass] || 8;
       const conMod = calculateModifier(player.attributes.con);
       const hpIncrease = Math.max(1, Math.floor(hitDie / 2) + 1 + conMod);
       player.maxHp += hpIncrease;
       player.hp += hpIncrease; // Heal on level up
       
       // Recalculate proficiency bonus using the dice utility
       player.proficiencyBonus = calculateProficiencyBonus(player.level);
     }
   }

  /**
   * Reset player XP and level (DM-only)
   */
  resetPlayerXP(playerId: string): void {
    const player = this._game.players.find(p => p.id === playerId);
    if (player) {
      player.xp = 0;
      player.level = 1;
      player.proficiencyBonus = calculateProficiencyBonus(1);

      // Reset HP to level 1 values
      const hitDie = HIT_DIE_BY_CLASS[player.characterClass] || 8;
      const conMod = calculateModifier(player.attributes.con);
      player.maxHp = hitDie + conMod;
      player.hp = player.maxHp;
    }
  }

  /**
   * Get all players in game
   */
  getAllPlayers(): Player[] {
    return JSON.parse(JSON.stringify(this._game.players));
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

  removePlayer(playerId: string): void {
    this._game.players = this._game.players.filter(p => p.id !== playerId);
  }

  // ---- Inventory & Equipment Management ----

  /**
   * Add item to player inventory
   */
  addItemToInventory(playerId: string, item: Item): void {
    const player = this._game.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");
    
    if (!player.inventory) {
      player.inventory = [];
    }
    player.inventory.push(item);
  }

  /**
   * Remove item from player inventory by itemId
   */
  removeItemFromInventory(playerId: string, itemId: string): void {
    const player = this._game.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");
    
    if (!player.inventory) return;
    
    const index = player.inventory.findIndex(i => i.id === itemId);
    if (index >= 0) {
      player.inventory.splice(index, 1);
    }
  }

  /**
   * Equip item to weapon or armor slot
   */
  equipItem(playerId: string, itemId: string, slot: "weapon" | "armor"): void {
    const player = this._game.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");
    
    if (!player.inventory) throw new Error("Inventory not found");
    
    const item = player.inventory.find(i => i.id === itemId);
    if (!item) throw new Error("Item not found in inventory");
    
    // Unequip any existing item in this slot
    if (slot === "weapon") {
      player.equippedWeapon = item;
    } else {
      player.equippedArmor = item;
    }
  }

  /**
   * Unequip item from weapon or armor slot
   */
  unequipItem(playerId: string, slot: "weapon" | "armor"): void {
    const player = this._game.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");
    
    if (slot === "weapon") {
      player.equippedWeapon = undefined;
    } else {
      player.equippedArmor = undefined;
    }
  }

  /**
   * Use consumable item on self (potion, etc.)
   */
  useConsumable(playerId: string, itemId: string): { healed: number } {
    const result = this.useItem(playerId, itemId);
    return { healed: result.healed ?? 0 };
  }

  /**
   * Get player's inventory
   */
  getPlayerInventory(playerId: string): Item[] {
    const player = this._game.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");
    
    return player.inventory ? [...player.inventory] : [];
  }

  /**
   * Get player's equipped items
    */
  getEquippedItems(playerId: string): { weapon?: Item; armor?: Item } {
    const player = this._game.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");
    
    return {
      weapon: player.equippedWeapon,
      armor: player.equippedArmor,
    };
  }

  /**
   * Equip weapon to player
   */
  equipWeapon(playerId: string, itemId: string): void {
    this.equipItem(playerId, itemId, "weapon");
    this.recalculatePlayerAC(this._game.players.find(p => p.id === playerId)!);
  }

  /**
   * Equip armor to player
   */
  equipArmor(playerId: string, itemId: string): void {
    this.equipItem(playerId, itemId, "armor");
    this.recalculatePlayerAC(this._game.players.find(p => p.id === playerId)!);
  }

  /**
   * Unequip weapon from player
   */
  unequipWeapon(playerId: string): void {
    this.unequipItem(playerId, "weapon");
    this.recalculatePlayerAC(this._game.players.find(p => p.id === playerId)!);
  }

  /**
   * Unequip armor from player
   */
  unequipArmor(playerId: string): void {
    this.unequipItem(playerId, "armor");
    this.recalculatePlayerAC(this._game.players.find(p => p.id === playerId)!);
  }

  /**
   * Recalculate player AC based on equipped armor
   */
  private recalculatePlayerAC(player: Player): void {
    // Base AC = 10 + DEX modifier
    const baseAC = 10 + Math.floor((player.attributes.dex - 10) / 2);
    
    // Add armor bonus if equipped
    const armorBonus = player.equippedArmor?.stats?.armorClassBonus || 0;
    
    player.ac = baseAC + armorBonus;
  }

  /**
   * Use consumable item (potion, etc.)
   */
  useItem(playerId: string, itemId: string, targetId?: string): { healed?: number; message: string } {
    const player = this._game.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");
    
    const item = player.inventory?.find(i => i.id === itemId);
    if (!item) throw new Error("Item not found in inventory");
    if (item.type !== "consumable") throw new Error("Item is not consumable");
    if (!item.stats?.healingAmount) throw new Error("Item has no healing effect");
    
    const healingAmount = item.stats.healingAmount;
    const target = targetId 
      ? this._game.players.find(p => p.id === targetId) || this._game.npcs.find(n => n.id === targetId)
      : player;
    
    if (!target) throw new Error("Target not found");
    
    // Apply healing
    const oldHp = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + healingAmount);
    const actualHealed = target.hp - oldHp;
    
    // Mark item as used (consume it)
    if (!player.usedItems) {
      player.usedItems = [];
    }
    player.usedItems.push(itemId);
    
    // Remove from inventory (consumed)
    const itemIndex = player.inventory.findIndex(i => i.id === itemId);
    if (itemIndex >= 0) {
      player.inventory.splice(itemIndex, 1);
    }
    
    return {
      healed: actualHealed,
      message: `Used ${item.name} and healed ${actualHealed} HP`
    };
  }

  /**
   * Calculate total weight of player's inventory
   */
  calculateTotalWeight(playerId: string): number {
    const player = this._game.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");
    
    if (!player.inventory || player.inventory.length === 0) {
      return 0;
    }
    
    return player.inventory.reduce((total, item) => total + item.weight, 0);
  }

  // ---- Buff/Debuff System ----

  /**
   * Apply temporary HP to player or NPC with duration
   */
  applyTemporaryHP(targetId: string, isPlayer: boolean, amount: number, duration: number): void {
    const entity = isPlayer
      ? this._game.players.find(p => p.id === targetId)
      : this._game.npcs.find(n => n.id === targetId);
    if (!entity) throw new Error(`${isPlayer ? "Player" : "NPC"} not found: ${targetId}`);

    const currentTempHp = (entity as Player | NPC).temporaryHp || 0;
    (entity as Player | NPC).temporaryHp = Math.max(currentTempHp, amount);
    (entity as Player | NPC).temporaryHpRemaining = duration;
  }

  /**
   * Apply buff to player or NPC
   */
  applyBuff(targetId: string, isPlayer: boolean, buff: { name: string; effect: string; bonus?: number; duration: number }): void {
    const entity = isPlayer
      ? this._game.players.find(p => p.id === targetId)
      : this._game.npcs.find(n => n.id === targetId);
    if (!entity) throw new Error(`${isPlayer ? "Player" : "NPC"} not found: ${targetId}`);

    const buffs = (entity as Player | NPC).buffs || [];
    const existingIndex = buffs.findIndex((b) => b.name === buff.name);
    if (existingIndex >= 0) {
      buffs[existingIndex] = buff;
    } else {
      buffs.push(buff);
    }
    (entity as Player | NPC).buffs = buffs;
  }

  /**
   * Remove buff from player or NPC
   */
  removeBuff(targetId: string, isPlayer: boolean, buffName: string): void {
    const entity = isPlayer
      ? this._game.players.find(p => p.id === targetId)
      : this._game.npcs.find(n => n.id === targetId);
    if (!entity) throw new Error(`${isPlayer ? "Player" : "NPC"} not found: ${targetId}`);

    const buffs = (entity as Player | NPC).buffs;
    if (!buffs) return;
    (entity as Player | NPC).buffs = buffs.filter((b) => b.name !== buffName);
  }

  /**
   * Reduce buff durations by 1 round (call at end of each combat round)
   */
  reduceBuffDurations(): void {
    // Reduce player buff durations
    for (const player of this._game.players) {
      if (player.buffs) {
        player.buffs = player.buffs.filter(b => {
          b.duration--;
          return b.duration > 0;
        });
      }
      
      // Reduce temporary HP duration
      if (player.temporaryHpRemaining !== undefined) {
        player.temporaryHpRemaining--;
        if (player.temporaryHpRemaining <= 0) {
          player.temporaryHp = undefined;
          player.temporaryHpRemaining = undefined;
        }
      }
    }
    
    // Reduce NPC buff durations
    for (const npc of this._game.npcs) {
      if (npc.buffs) {
        npc.buffs = npc.buffs.filter(b => {
          b.duration--;
          return b.duration > 0;
        });
      }
      
      // Reduce temporary HP duration
      if (npc.temporaryHpRemaining !== undefined) {
        npc.temporaryHpRemaining--;
        if (npc.temporaryHpRemaining <= 0) {
          npc.temporaryHp = undefined;
          npc.temporaryHpRemaining = undefined;
        }
      }
    }
  }

  /**
   * Get player's current buffs
   */
  getPlayerBuffs(playerId: string): { name: string; effect: string; bonus?: number; duration: number }[] {
    const player = this._game.players.find(p => p.id === playerId);
    if (!player) throw new Error("Player not found");
    
    return player.buffs || [];
  }

  /**
   * Get NPC's current buffs
   */
  getNPCBuffs(npcId: string): { name: string; effect: string; bonus?: number; duration: number }[] {
    const npc = this._game.npcs.find(n => n.id === npcId);
    if (!npc) throw new Error("NPC not found");
    
    return npc.buffs || [];
  }

  /**
   * Save game to disk
   */
  saveGame(): void {
    storage.saveGame(this._game);
  }
}
