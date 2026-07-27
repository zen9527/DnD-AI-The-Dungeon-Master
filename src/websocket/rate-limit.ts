import type { MessageType } from "../types/index.js";

/**
 * Budgets for the messages that make the server call the LLM.
 *
 * These exist to stop a script looping thousands of requests, not to police a
 * person. A human playing — or a developer clicking around — must never hit
 * them, because the socket lives for the whole session and the only feedback
 * is a transient toast: an over-tight limit reads as "the app just stopped
 * working", which is exactly what a first version of this did.
 *
 * Game setup and the turn loop get separate budgets so a burst of one can
 * never starve the other.
 */
interface Budget {
  readonly name: string;
  readonly types: ReadonlySet<MessageType>;
  readonly maxPerWindow: number;
  readonly windowMs: number;
}

const MINUTE = 60_000;

const BUDGETS: readonly Budget[] = [
  {
    name: "turn",
    types: new Set<MessageType>(["PLAYER_ACTION"]),
    // A turn takes tens of seconds; 30/min is far above honest play.
    maxPerWindow: 30,
    windowMs: MINUTE,
  },
  {
    name: "setup",
    // Each of these kicks off an opening scene, so they cost tokens too — but
    // they are deliberate, low-frequency acts.
    types: new Set<MessageType>(["CREATE_GAME", "JOIN_GAME"]),
    maxPerWindow: 20,
    windowMs: MINUTE,
  },
];

/** The budget a message draws from, or undefined when it is free. */
function budgetFor(type: MessageType): Budget | undefined {
  return BUDGETS.find(budget => budget.types.has(type));
}

/**
 * Per-connection sliding-window limiter over LLM-triggering messages.
 *
 * Without it a single client can loop `PLAYER_ACTION` and burn an entire API
 * budget — there is no authentication, so anyone with the game link can.
 */
export class LLMRateLimiter {
  /** `${connectionId}:${budgetName}` -> timestamps inside the window. */
  private hits = new Map<string, number[]>();

  /** Optional overrides, used by tests to exercise the boundary cheaply. */
  constructor(
    private readonly maxOverride?: number,
    private readonly windowOverride?: number
  ) {}

  /** Whether this message type counts against any budget. */
  static isBillable(type: MessageType): boolean {
    return budgetFor(type) !== undefined;
  }

  private limitsFor(budget: Budget): { max: number; windowMs: number } {
    return {
      max: this.maxOverride ?? budget.maxPerWindow,
      windowMs: this.windowOverride ?? budget.windowMs,
    };
  }

  /**
   * Record an attempt. Returns false when the caller has exhausted the budget
   * this message draws from, in which case the attempt is not recorded.
   */
  tryConsume(connectionId: string, type: MessageType, now: number = Date.now()): boolean {
    const budget = budgetFor(type);
    if (!budget) return true;

    const { max, windowMs } = this.limitsFor(budget);
    const key = `${connectionId}:${budget.name}`;
    const recent = (this.hits.get(key) ?? []).filter(at => at > now - windowMs);

    if (recent.length >= max) {
      this.hits.set(key, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Seconds until an attempt of this kind would be allowed again. */
  retryAfterSeconds(connectionId: string, type: MessageType, now: number = Date.now()): number {
    const budget = budgetFor(type);
    if (!budget) return 0;

    const recent = this.hits.get(`${connectionId}:${budget.name}`);
    if (!recent?.length) return 0;

    const { windowMs } = this.limitsFor(budget);
    return Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
  }

  /** Drop a connection's history when its socket closes. */
  forget(connectionId: string): void {
    for (const key of this.hits.keys()) {
      if (key.startsWith(`${connectionId}:`)) this.hits.delete(key);
    }
  }
}
