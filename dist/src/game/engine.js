import { generateId } from "../utils/id.js";
import { rollDice, calculateTotal } from "./dice.js";
import { isHit, calculateInitiative, rollHitDice } from "./rules.js";
import { LLMClient } from "../llm/client.js";
import { buildSystemPrompt, buildActionPrompt } from "../llm/prompts.js";
import { parseLLMResponse } from "../llm/parser.js";
import { scenarioDescriptions } from "../../shared/schemas/scenario.js";
import { getLocalizedMessage } from "../utils/locale-loader.js";
export class GameEngine {
    _game;
    llmClient;
    _currentInitiativeIndex;
    _round;
    // Story summary: rolling digest of key events for long-term memory
    // Updated every few turns to keep the DM aware of the big picture
    _storySummary = "";
    _turnCount = 0;
    SUMMARY_INTERVAL = 5; // Update summary every N turns
    constructor(gameData, llmBaseUrl, llmApiKey, llmModel) {
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
            content: buildSystemPrompt(this._game.scenario || "dungeon", creatorLocale),
        });
    }
    get game() {
        return JSON.parse(JSON.stringify(this._game));
    }
    get id() { return this._game.id; }
    get name() { return this._game.name; }
    // ---- Initiative ----
    startInitiative() {
        const initiative = [];
        for (const player of this._game.players) {
            initiative.push({ playerId: player.id, score: calculateInitiative(player.attributes.dex) });
        }
        for (const npc of this._game.npcs) {
            initiative.push({ npcId: npc.id, score: calculateInitiative(npc.attributes.dex) });
        }
        initiative.sort((a, b) => b.score - a.score);
        this._game.npcs.forEach((npc, i) => {
            if (initiative[i]?.npcId === npc.id)
                npc.initiative = initiative[i].score;
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
    getCurrentPlayer() {
        const allEntities = this._game.npcs.length > 0
            ? [...this._game.npcs, ...this._game.players].sort((a, b) => b.initiative - a.initiative)
            : this._game.players;
        return allEntities[this._currentInitiativeIndex % allEntities.length];
    }
    advanceTurn() {
        const allEntities = this._game.npcs.length > 0
            ? [...this._game.npcs, ...this._game.players].sort((a, b) => b.initiative - a.initiative)
            : this._game.players;
        this._currentInitiativeIndex = (this._currentInitiativeIndex + 1) % allEntities.length;
        if (this._currentInitiativeIndex === 0)
            this._round++;
    }
    // ---- World State (compact game state for LLM context) ----
    /**
     * Build a compact world state string (~100 tokens) that gives the DM
     * current game state without repeating full player stats every turn.
     */
    buildWorldState(player) {
        const npcLines = this._game.npcs.map(n => `  - ${n.name}: HP ${n.hp}/${n.maxHp} AC ${n.ac} [${n.role}]`);
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
    async updateStorySummary(player) {
        // Get recent conversation for summarization
        const recentHistory = this._game.conversationHistory.slice(-10);
        const historyText = recentHistory.map(m => `[${m.role}]: ${m.content.substring(0, 300)}`).join('\n');
        const locale = player.locale || "en-US";
        const langNames = {
            "en-US": "English", "zh-CN": "Chinese (Simplified)", "ja-JP": "Japanese",
            "es-ES": "Spanish", "ko-KR": "Korean",
        };
        const language = langNames[locale] || "English";
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
                { role: "system", content: `You are a D&D adventure summarizer. Respond in ${language}. Be concise.` },
                { role: "user", content: summaryPrompt },
            ];
            const summaryResult = await this.llmClient.streamChat(summaryMessages, {
                onChunk: () => { }, // Silent - don't stream summary updates to client
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
        }
        catch {
            // Summary update is best-effort, don't fail the turn
            console.warn(`[Engine] Story summary update skipped`);
        }
    }
    // ---- Player Action ----
    async handlePlayerAction(payload, playerId, callbacks) {
        const player = this._game.players.find(p => p.id === playerId);
        if (!player)
            throw new Error("Player not found");
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
            const narrativeMsg = {
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
        let target;
        if (payload.target) {
            const targetName = payload.target;
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
        // Build the action context — lightweight, no player stats (they're in world state)
        const actionContext = buildActionPrompt(payload.action, {
            currentPlayer: player,
            target,
            diceResult,
            combatStatus,
            scenario: this._game.scenario || "dungeon",
            locale: player.locale || "en-US",
        });
        // Deduct spell slot if player is using a known spell
        const usedSpell = player.spells?.find(s => actionContext.toLowerCase().includes(s.name.toLowerCase()));
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
            }
            else {
                // No slots left — LLM will narrate the failure naturally
                console.log(`[Engine] No slots for spell: ${usedSpell.name}`);
            }
        }
        // Build messages: system + story summary + world state + recent history + action
        // Story summary gives long-term memory, recent history gives short-term context
        const systemPrompt = buildSystemPrompt(this._game.scenario, player.locale || "en-US");
        const worldState = this.buildWorldState(player);
        const maxHistoryTurns = 4; // Only 4 recent turns needed — summary covers the rest
        const historyStartIdx = Math.max(1, this._game.conversationHistory.length - (maxHistoryTurns * 2));
        const messages = [
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
                role: msg.role,
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
            this.updateStorySummary(player).catch(() => { });
        }
        if (parsed.structured.creatureHp) {
            const creature = this._game.npcs.find(n => n.name === parsed.structured.creatureHp.name);
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
            const idx = this._game.npcs.findIndex(n => n.name === parsed.structured.creatureHp.name);
            if (idx >= 0) {
                this._game.npcs.splice(idx, 1);
            }
        }
        if (parsed.structured.newNPCs) {
            this._game.npcs.push(...parsed.structured.newNPCs);
        }
        this.advanceTurn();
        const narrativeMsg = {
            id: generateId(),
            content: parsed.fullNarrative,
            type: "narrative",
            timestamp: Date.now(),
        };
        this._game.chatHistory.push(narrativeMsg);
        if (this._game.chatHistory.length > 100)
            this._game.chatHistory.shift();
        return parsed;
    }
    // ---- Short Rest (D&D 5e) ----
    async handleShortRest(player, playerId, callbacks) {
        const playerIdx = this._game.players.findIndex(p => p.id === playerId);
        if (playerIdx < 0)
            throw new Error("Player not found");
        // Roll hit dice for healing (roll 1dHD + CON mod, up to level times)
        const hdAvailable = (player.hitDice?.total || 0) - (player.hitDice?.used || 0);
        let totalHealed = 0;
        if (hdAvailable > 0) {
            // Roll one hit die for short rest healing
            const healResult = rollHitDice(player);
            totalHealed = healResult.healed;
            player.hp = Math.min(player.maxHp, player.hp + totalHealed);
            this._game.players[playerIdx].hitDice.used += 1;
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
        const narrativeMsg = {
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
        const messages = [
            { role: "system", content: buildSystemPrompt(this._game.scenario, player.locale || "en-US") },
        ];
        if (this._storySummary) {
            messages.push({ role: "user", content: `ADVENTURE SUMMARY:\n${this._storySummary}` });
            messages.push({ role: "assistant", content: "Understood." });
        }
        messages.push({ role: "user", content: this.buildWorldState(player) });
        messages.push(...this._game.conversationHistory.slice(historyStartIdx).map(msg => ({
            role: msg.role,
            content: msg.content,
        })));
        messages.push({ role: "user", content: restPrompt });
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
    async generateOpeningScene(callbacks) {
        const player = this._game.players[0];
        if (!player)
            throw new Error("No players in game");
        const scenario = this._game.scenario || "dungeon";
        const locale = player.locale || "en-US";
        const whatDoYouDo = getLocalizedMessage(locale, "opening.what_do_you_do");
        const openingPrompt = `You are the Dungeon Master. This is the opening scene of a new adventure.

SCENARIO: ${scenarioDescriptions[scenario].label} — ${scenarioDescriptions[scenario].description}

Player "${player.characterName}" (${player.characterClass}, ${player.race}, Lv.${player.level}) has just arrived. Their attributes: Str=${player.attributes.str} Dex=${player.attributes.dex} Con=${player.attributes.con} Int=${player.attributes.int} Wis=${player.attributes.wis} Cha=${player.attributes.cha}.

Describe the opening scene: where the player is, what they see, hear, and feel. Introduce the atmosphere and hint at the adventure ahead. Set the mood. DO NOT ask for an action — just describe the scene and end with "${whatDoYouDo}"

Keep it to 2-4 paragraphs. End with the JSON block.`;
        const messages = [
            { role: "system", content: buildSystemPrompt(scenario, player.locale || "en-US") },
            { role: "user", content: this.buildWorldState(player) },
            { role: "assistant", content: "Understood. Here is the opening scene:" },
            { role: "user", content: openingPrompt },
        ];
        // Use 90s idle timeout - opening scenes can be long with structured JSON output
        const result = await this.llmClient.streamChat(messages, callbacks, 90000);
        const parsed = parseLLMResponse(result);
        // Update state after stream completes (onEnd already fired but we need complete state)
        this._game.conversationHistory.push({ role: "user", content: openingPrompt });
        this._game.conversationHistory.push({ role: "assistant", content: parsed.fullNarrative });
        const narrativeMsg = {
            id: generateId(),
            content: parsed.fullNarrative,
            type: "narrative",
            timestamp: Date.now(),
        };
        this._game.chatHistory.push(narrativeMsg);
        if (this._game.chatHistory.length > 100)
            this._game.chatHistory.shift();
        return parsed;
    }
    // ---- Chat ----
    addChatMessage(playerId, content) {
        const player = this._game.players.find(p => p.id === playerId);
        if (!player)
            throw new Error("Player not found");
        const message = {
            id: generateId(),
            playerId,
            playerName: player.name,
            characterName: player.characterName,
            content,
            type: "text",
            timestamp: Date.now(),
        };
        this._game.chatHistory.push(message);
        if (this._game.chatHistory.length > 100)
            this._game.chatHistory.shift();
    }
    // ---- NPC Creation ----
    addNPC(name, description, role) {
        const npc = {
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
    addEvent(title, description) {
        const msg = {
            id: generateId(),
            content: `Event: ${title} — ${description}`,
            type: "event",
            timestamp: Date.now(),
        };
        this._game.chatHistory.push(msg);
    }
    getPlayerCount() { return this._game.players.length; }
    getMaxPlayers() { return this._game.maxPlayers; }
    getCreatedAt() { return this._game.createdAt; }
    addPlayer(player) {
        this._game.players.push(player);
    }
}
//# sourceMappingURL=engine.js.map