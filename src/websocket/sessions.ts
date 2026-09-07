import * as fs from "fs";
import * as path from "path";
import { randomBytes } from "crypto";
import { getStorageDir } from "../utils/storage.js";

interface Seat {
  gameId: string;
  playerId: string;
}

/** Name of the side file that carries tokens across restarts. Lives inside the
 *  saves directory, which is git-ignored and never served over HTTP. */
const SESSIONS_FILE = ".sessions.json";

/**
 * Maps an opaque rejoin token to the seat it owns.
 *
 * Tokens live here rather than on the `Player` object on purpose: the whole
 * game state — every player record included — is broadcast to every client, so
 * a token stored there would let anyone take anyone else's seat.
 *
 * The map is persisted to `.sessions.json` so seats survive a server restart:
 * without it every player would return as a stranger and duplicate themselves
 * in the roster. The file holds credentials in plain text, which is an
 * accepted trade-off for this deployment — a private table on a LAN, where
 * anyone who can read that file can equally read `.env` and every save on the
 * same disk. It must never be served, broadcast, or committed.
 */
class PlayerSessionRegistry {
  private seats = new Map<string, Seat>();
  /** Reverse index so re-issuing for a seat replaces the old token. */
  private tokensBySeat = new Map<string, string>();

  private static key(gameId: string, playerId: string): string {
    return `${gameId}:${playerId}`;
  }

  private file(): string {
    return path.join(getStorageDir(), SESSIONS_FILE);
  }

  /** Read persisted tokens at startup. A missing or corrupt file starts clean. */
  load(): void {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file(), "utf-8")) as Record<string, Seat>;
      for (const [token, seat] of Object.entries(raw)) {
        if (!token || !seat?.gameId || !seat?.playerId) continue;
        this.seats.set(token, seat);
        this.tokensBySeat.set(PlayerSessionRegistry.key(seat.gameId, seat.playerId), token);
      }
    } catch {
      // First run, or a file we cannot trust: start empty rather than crash.
    }
  }

  /** Atomic write (tmp + rename) after every mutation; best-effort 0600. */
  private persist(): void {
    const dir = getStorageDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tmp = `${this.file()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.seats)));
    try { fs.chmodSync(tmp, 0o600); } catch { /* POSIX only; Windows inherits directory ACLs */ }
    fs.renameSync(tmp, this.file());
  }

  /** Mint a token for a seat, retiring any token that seat already had. */
  issue(gameId: string, playerId: string): string {
    const seatKey = PlayerSessionRegistry.key(gameId, playerId);

    const previous = this.tokensBySeat.get(seatKey);
    if (previous) this.seats.delete(previous);

    const token = randomBytes(24).toString("base64url");
    this.seats.set(token, { gameId, playerId });
    this.tokensBySeat.set(seatKey, token);
    this.persist();
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
    this.persist();
  }

  /** Drop every token for a game once it is gone. */
  releaseGame(gameId: string): void {
    const doomed = [...this.seats.entries()].filter(([, seat]) => seat.gameId === gameId).map(([t]) => t);
    if (doomed.length === 0) return;
    for (const token of doomed) this.release(token);
  }

  /** Test seam. Clears memory only — call between tests, not on disk. */
  clear(): void {
    this.seats.clear();
    this.tokensBySeat.clear();
  }
}

export const playerSessions = new PlayerSessionRegistry();
