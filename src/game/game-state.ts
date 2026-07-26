import type { Game } from "../types/index.js";

/**
 * Shared, mutable game state plus a cached read-only snapshot.
 *
 * `GameEngine` and every service it composes hold the same `GameState`, so a
 * mutation made by one is visible to all. Reads go through `snapshot`, which
 * deep-copies once and caches until the next mutation — callers get a value
 * they cannot accidentally corrupt without paying for a copy on every access.
 *
 * All mutation must go through `mutate()`. That is what keeps the cached
 * snapshot from going stale; reaching into `raw` and writing directly leaves
 * readers seeing the previous state.
 */
export class GameState {
  private game: Game;
  private cachedSnapshot: Game | null = null;
  /** Set by every mutation, cleared once the game is written to disk. */
  private dirty = false;

  constructor(game: Game) {
    this.game = game;
  }

  /**
   * The live game object, for reads that do not need isolation.
   * Do not mutate through this — use `mutate()`.
   */
  get raw(): Game {
    return this.game;
  }

  /** A stable deep copy of the game, recomputed only after a mutation. */
  get snapshot(): Game {
    if (!this.cachedSnapshot) {
      this.cachedSnapshot = JSON.parse(JSON.stringify(this.game)) as Game;
    }
    return this.cachedSnapshot;
  }

  /** Apply a mutation and invalidate the snapshot, even if the mutation throws. */
  mutate<T>(fn: (game: Game) => T): T {
    try {
      return fn(this.game);
    } finally {
      this.cachedSnapshot = null;
      this.dirty = true;
    }
  }

  /** True when there are changes the autosave has not yet written. */
  get hasUnsavedChanges(): boolean {
    return this.dirty;
  }

  /** Called after a successful write. */
  markSaved(): void {
    this.dirty = false;
  }
}
