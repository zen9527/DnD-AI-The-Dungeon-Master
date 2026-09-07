import { gameState } from "../game-state.js";
import { t } from "../i18n.js";
import { escapeHtml } from "../utils.js";
import { icon } from "../icons.js";
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

/**
 * Render a dice roll for the chat log as a wax seal stamped into the page:
 * the total lives in the seal, the arithmetic sits beside it. A natural 20
 * stamps in gilt, a natural 1 in black wax. Skill checks tint their detail
 * line jade or rust. Returns HTML — every interpolated value is escaped.
 */
export function formatDiceResult(dice: DiceRoll): string {
  const natural = dice.rolls[0];
  let variant = "";
  if (dice.diceType === 20 && natural === 20) variant = " crit";
  else if (dice.diceType === 20 && natural === 1) variant = " fumble";

  let detail: string;
  if (dice.skillCheck) {
    const labelKey = SKILL_LABEL_KEYS[dice.skillCheck.skill as keyof typeof SKILL_LABEL_KEYS];
    detail = t("dice.check_detail", {
      skill: labelKey ? t(labelKey) : dice.skillCheck.skill,
      result: t(dice.skillCheck.success ? "dice.success" : "dice.failure"),
      dc: dice.skillCheck.dc,
    });
  } else {
    const rolls = dice.rolls.join(" + ");
    const modifier = dice.modifier ? ` ${dice.modifier > 0 ? "+" : "-"}${Math.abs(dice.modifier)}` : "";
    detail = `d${dice.diceType}${modifier} (${rolls})`;
  }

  const tone = dice.skillCheck ? (dice.skillCheck.success ? " success" : " failure") : "";
  return `<span class="dice-roll"><span class="dice-seal${variant}">${escapeHtml(String(dice.total))}</span><span class="dice-detail${tone}">${escapeHtml(detail)}</span></span>`;
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
      // formatDiceResult returns composed HTML with its values already escaped.
      content += `<br>${formatDiceResult(message.diceResult)}`;
    }
    // The transient failure card carries its own way back: resend the turn.
    if (message.id === "stream-error" && gameState.lastPlayerAction) {
      content += ` <button type="button" class="retry-stream-btn">${t("stream_error.retry")}</button>`;
    }

    const el = document.createElement("div");
    el.className = `message ${message.type} ${isOwn ? "own" : ""}`;
    el.innerHTML = `
      <div class="message-header">
        <strong class="${isDMNarrative ? "dm-sender" : ""}">${isDMNarrative ? `<span class="dm-candle">${icon("candle")}</span> ` : ""}${escapeHtml(senderName)}</strong>
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

    // Candle is mounted once per stream — rebuilding it per token would pin
    // its flicker at frame 0 and thrash the filter layer on phones.
    if (!display.querySelector(".dm-candle")) {
      display.innerHTML = `<div class="dm-stream-row"><span class="dm-candle">${icon("candle")}</span><div class="stream-body"></div></div>`;
    }
    const body = display.querySelector<HTMLElement>(".stream-body");
    if (body) {
      body.innerHTML = `<div class="streaming"><span class="typing">${escapeHtml(narrative)}<span class="cursor">▊</span></span></div>`;
    }
    display.scrollTop = display.scrollHeight;
  }

  clearStream(): void {
    const display = this.streamEl;
    if (display) display.innerHTML = "";
  }
}
