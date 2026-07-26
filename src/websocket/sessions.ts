import { randomBytes } from "crypto";

interface Seat {
  gameId: string;
  playerId: string;
}

/**
 * Maps an opaque rejoin token to the seat it owns.
 *
 * Tokens live here rather than on the `Player` object on purpose: the whole
 * game state — every player record included — is broadcast to every client, so
 * a token stored there would let anyone take anyone else's seat.
 *
 * In-memory only. A server restart invalidates every token, which is
 * acceptable: running games are rebuilt from disk on restart anyway, and the
 * alternative is persisting credentials to a plaintext save file.
 */
class PlayerSessionRegistry {
  private seats = new Map<string, Seat>();
  /** Reverse index so re-issuing for a seat replaces the old token. */
  private tokensBySeat = new Map<string, string>();

  private static key(gameId: string, playerId: string): string {
    return `${gameId}:${playerId}`;
  }

  /** Mint a token for a seat, retiring any token that seat already had. */
  issue(gameId: string, playerId: string): string {
    const seatKey = PlayerSessionRegistry.key(gameId, playerId);

    const previous = this.tokensBySeat.get(seatKey);
    if (previous) this.seats.delete(previous);

    const token = randomBytes(24).toString("base64url");
    this.seats.set(token, { gameId, playerId });
    this.tokensBySeat.set(seatKey, token);
    return token;
  }

  /** Look up the seat a token owns, or undefined if it is unknown or retired. */
  resolve(token: string): Seat | undefined {
    return this.seats.get(token);
  }

  /** Drop a single token (used when a player leaves for good). */
  release(token: string): void {
    const seat = this.seats.get(token);
    if (!seat) return;
    this.seats.delete(token);
    this.tokensBySeat.delete(PlayerSessionRegistry.key(seat.gameId, seat.playerId));
  }

  /** Drop every token for a game once it is gone. */
  releaseGame(gameId: string): void {
    for (const [token, seat] of this.seats) {
      if (seat.gameId === gameId) this.release(token);
    }
  }

  /** Test seam. */
  clear(): void {
    this.seats.clear();
    this.tokensBySeat.clear();
  }
}

export const playerSessions = new PlayerSessionRegistry();
