import { log } from "./logger.js";
import * as fs from "fs";
import * as path from "path";
import type { ChatMessage, Game } from "../types/index.js";

/**
 * Where saves live. Overridable so an end-to-end run gets a scratch directory
 * instead of writing into somebody's real campaigns. Read per call: tests set
 * the variable after this module is first imported.
 */
export function getStorageDir(): string {
  return process.env.DND_SAVED_GAMES_DIR || path.join(process.cwd(), "saved_games");
}

function ensureStorageDir(): void {
  const dir = getStorageDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Merge the chat already on disk with what is still in memory.
 *
 * The engine keeps only a recent window of messages, so writing that window
 * straight out would delete the campaign's earlier chapters from the save file
 * a little more each time it was saved. Anything previously written is kept,
 * and only genuinely new messages are appended.
 */
function mergeChatHistory(existing: ChatMessage[], current: ChatMessage[]): ChatMessage[] {
  if (existing.length === 0) return current;

  const seen = new Set(existing.map(m => m.id));
  const appended = current.filter(m => !seen.has(m.id));
  return [...existing, ...appended];
}

/** Unique per write so concurrent writers never share a scratch file. */
let tmpCounter = 0;

/**
 * Write beside the target, then rename over it: a crash mid-write can never
 * leave a half-written file where the old one was. Node's rename replaces an
 * existing file atomically on Windows too. The scratch name is unique per
 * call — two writers into the same directory cannot clobber each other.
 */
export function atomicWriteFileSync(filePath: string, data: string): void {
  const tmpPath = `${filePath}.${process.pid}.${tmpCounter++}.tmp`;
  fs.writeFileSync(tmpPath, data);
  try { fs.chmodSync(tmpPath, 0o600); } catch { /* POSIX only; Windows inherits directory ACLs */ }
  fs.renameSync(tmpPath, filePath);
}

export function saveGame(game: Game): string {
  ensureStorageDir();

  const filePath = path.join(getStorageDir(), `${game.id}.json`);

  // Preserve history the in-memory game has already aged out.
  const previous = loadGame(game.id);
  const toWrite: Game = previous
    ? { ...game, chatHistory: mergeChatHistory(previous.chatHistory ?? [], game.chatHistory ?? []) }
    : { ...game };
  toWrite.lastPlayedAt = Date.now();

  atomicWriteFileSync(filePath, JSON.stringify(toWrite, null, 2));

  log.info(`[Storage] Saved game ${game.id} (${toWrite.chatHistory?.length ?? 0} messages)`);
  return game.id;
}

/**
 * Saves written before `Game.events` was removed still carry the key. It was
 * never read, so it is dropped rather than migrated.
 */
function stripRetiredFields(game: Game & { events?: unknown }): Game {
  delete game.events;
  return game;
}

export function loadGame(gameId: string): Game | null {
  ensureStorageDir();
  
  const filePath = path.join(getStorageDir(), `${gameId}.json`);
  
  if (!fs.existsSync(filePath)) {
    log.warn(`[Storage] Game ${gameId} not found`);
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const game = stripRetiredFields(JSON.parse(content));
    log.info(`[Storage] Loaded game ${gameId}`);
    return game;
  } catch (error) {
    log.error(`[Storage] Failed to load game ${gameId}:`, error);
    return null;
  }
}

export function listGames(): Array<{ id: string; name: string; createdAt: number; lastPlayedAt: number }> {
  ensureStorageDir();
  
  const files = fs.readdirSync(getStorageDir()).filter(f => f.endsWith(".json"));
  
  return files.map(file => {
    const gameId = file.replace(".json", "");
    const filePath = path.join(getStorageDir(), file);
    
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const game = JSON.parse(content) as Game;
      // Old saves predate lastPlayedAt; creation is the best we know.
      return { id: game.id, name: game.name, createdAt: game.createdAt, lastPlayedAt: game.lastPlayedAt ?? game.createdAt };
    } catch {
      return null;
    }
  }).filter((g): g is NonNullable<typeof g> => g !== null)
    // The campaign book reads newest-first: what you played lately floats up.
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
}

export function deleteGame(gameId: string): boolean {
  ensureStorageDir();
  
  const filePath = path.join(getStorageDir(), `${gameId}.json`);
  
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  fs.unlinkSync(filePath);
  log.info(`[Storage] Deleted game ${gameId}`);
  return true;
}
