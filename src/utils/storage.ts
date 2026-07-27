import * as fs from "fs";
import * as path from "path";
import type { ChatMessage, Game } from "../types/index.js";

const STORAGE_DIR = path.join(process.cwd(), "saved_games");

function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
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

export function saveGame(game: Game): string {
  ensureStorageDir();

  const filePath = path.join(STORAGE_DIR, `${game.id}.json`);

  // Preserve history the in-memory game has already aged out.
  const previous = loadGame(game.id);
  const toWrite: Game = previous
    ? { ...game, chatHistory: mergeChatHistory(previous.chatHistory ?? [], game.chatHistory ?? []) }
    : game;

  fs.writeFileSync(filePath, JSON.stringify(toWrite, null, 2));

  console.log(`[Storage] Saved game ${game.id} (${toWrite.chatHistory?.length ?? 0} messages)`);
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
  
  const filePath = path.join(STORAGE_DIR, `${gameId}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`[Storage] Game ${gameId} not found`);
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const game = stripRetiredFields(JSON.parse(content));
    console.log(`[Storage] Loaded game ${gameId}`);
    return game;
  } catch (error) {
    console.error(`[Storage] Failed to load game ${gameId}:`, error);
    return null;
  }
}

export function listGames(): Array<{ id: string; name: string; createdAt: number }> {
  ensureStorageDir();
  
  const files = fs.readdirSync(STORAGE_DIR).filter(f => f.endsWith(".json"));
  
  return files.map(file => {
    const gameId = file.replace(".json", "");
    const filePath = path.join(STORAGE_DIR, file);
    
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const game = JSON.parse(content) as Game;
      return { id: game.id, name: game.name, createdAt: game.createdAt };
    } catch {
      return null;
    }
  }).filter((g): g is NonNullable<typeof g> => g !== null);
}

export function deleteGame(gameId: string): boolean {
  ensureStorageDir();
  
  const filePath = path.join(STORAGE_DIR, `${gameId}.json`);
  
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  fs.unlinkSync(filePath);
  console.log(`[Storage] Deleted game ${gameId}`);
  return true;
}
