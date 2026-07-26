import type { MessageType } from "../types/index.js";

/**
 * Messages that make the server call the LLM, and therefore cost money.
 * Everything else (chat, dice, DM controls) is cheap and stays unlimited.
 */
const BILLABLE_MESSAGES: ReadonlySet<MessageType> = new Set<MessageType>([
  "PLAYER_ACTION",
  "CREATE_GAME",
  "JOIN_GAME",
]);

const WINDOW_MS = 60_000;
/** A turn takes tens of seconds, so this is well clear of honest play. */
const MAX_PER_WINDOW = 12;

/**
 * A per-connection sliding-window limiter on the messages that trigger LLM
 * spend.
 *
 * Without it a single client can loop `PLAYER_ACTION` and burn an entire API
 * budget — there is no authentication, so anyone with the game link can.
 */
export class LLMRateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly maxPerWindow: number = MAX_PER_WINDOW,
    private readonly windowMs: number = WINDOW_MS
  ) {}

  /** Whether this message type counts against the budget at all. */
  static isBillable(type: MessageType): boolean {
    return BILLABLE_MESSAGES.has(type);
  }

  /**
   * Record an attempt. Returns false when the caller has exhausted its budget,
   * in which case the attempt is not recorded.
   */
  tryConsume(connectionId: string, type: MessageType, now: number = Date.now()): boolean {
    if (!LLMRateLimiter.isBillable(type)) return true;

    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(connectionId) ?? []).filter(at => at > cutoff);

    if (recent.length >= this.maxPerWindow) {
      this.hits.set(connectionId, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(connectionId, recent);
    return true;
  }

  /** Seconds until the caller's next attempt would be allowed. */
  retryAfterSeconds(connectionId: string, now: number = Date.now()): number {
    const recent = this.hits.get(connectionId);
    if (!recent?.length) return 0;
    return Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000));
  }

  /** Drop a connection's history when its socket closes. */
  forget(connectionId: string): void {
    this.hits.delete(connectionId);
  }
}
