import { gameState } from "../game-state.js";
import { t } from "../i18n.js";
import { escapeHtml } from "../utils.js";
import type { ChatMessage, DiceRoll } from "../../../shared/index.js";

/**
 * Skill names the server reports, mapped to locale keys. The server speaks
 * English skill names; the UI shows them in the player's language.
 */
const SKILL_LABEL_KEYS = {
  Stealth: "skill.stealth",
  Perception: "skill.perception",
  Persuasion: "skill.persuasion",
  Intimidation: "skill.intimidation",
  Investigation: "skill.investigation",
  Arcana: "skill.arcana",
  Athletics: "skill.athletics",
  Dodge: "skill.dodge",
  Attack: "skill.attack",
} as const;

/** Render a dice roll for the chat log, localising the skill name and outcome. */
export function formatDiceResult(dice: DiceRoll): string {
  if (!dice.skillCheck) {
    return `🎲 d20: ${dice.total} (${dice.rolls[0] || dice.total} + ${dice.modifier})`;
  }

  const labelKey = SKILL_LABEL_KEYS[dice.skillCheck.skill as keyof typeof SKILL_LABEL_KEYS];

  return t("dice.skill_check", {
    skill: labelKey ? t(labelKey) : dice.skillCheck.skill,
    total: dice.total,
    roll: dice.rolls[0] || dice.total,
    mod: dice.modifier,
    result: t(dice.skillCheck.success ? "dice.success" : "dice.failure"),
    dc: dice.skillCheck.dc,
  });
}

/**
 * The scrolling message log and the live "DM is typing" stream above it.
 *
 * Messages are re-rendered wholesale from `gameState` because the server sends
 * the authoritative chat history with most updates; `append` is the fast path
 * for a single new message.
 */
export class ChatView {
  private get messagesEl(): HTMLElement | null {
    return document.getElementById("chat-messages");
  }

  private get streamEl(): HTMLElement | null {
    return document.getElementById("stream-display");
  }

  /** Re-render the whole log from current state. */
  render(): void {
    const container = this.messagesEl;
    if (!container) return;

    container.innerHTML = "";
    for (const message of gameState.game?.chatHistory || []) {
      this.append(message);
    }
    container.scrollTop = container.scrollHeight;
  }

  /** Append a single message and scroll it into view. */
  append(message: ChatMessage): void {
    const container = this.messagesEl;
    if (!container) return;

    const isDMNarrative = message.type === "narrative" || !message.playerName;
    const isOwn = !isDMNarrative && message.playerId === gameState.currentPlayer?.id;
    const senderName = isDMNarrative
      ? t("dm.name")
      : message.characterName || message.playerName || t("player.unknown");

    let content = escapeHtml(message.content);
    if (message.diceResult) {
      content += `<br><strong>${escapeHtml(formatDiceResult(message.diceResult))}</strong>`;
    }

    const el = document.createElement("div");
    el.className = message.type === "emote"
      ? `message emote ${isOwn ? "own" : ""}`
      : `message ${message.type} ${isOwn ? "own" : ""}`;
    el.innerHTML = `
      <div class="message-header">
        <strong class="${isDMNarrative ? "dm-sender" : ""}">${escapeHtml(senderName)}</strong>
        <span class="timestamp">${new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <div class="message-content">${content}</div>
    `;

    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  /** Show the partial narrative arriving from the DM, with a blinking cursor. */
  renderStream(): void {
    const display = this.streamEl;
    if (!display) return;

    // The buffer still contains the raw ---JSON--- envelope; strip it for display.
    const narrative = gameState.getParsedNarrative();
    display.innerHTML = `<div class="streaming"><span class="typing">${escapeHtml(narrative)}<span class="cursor">▊</span></span></div>`;
    display.scrollTop = display.scrollHeight;
  }

  clearStream(): void {
    const display = this.streamEl;
    if (display) display.innerHTML = "";
  }
}
