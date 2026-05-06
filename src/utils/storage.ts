import * as fs from "fs";
import * as path from "path";
import type { Game } from "../types/index.js";

const STORAGE_DIR = path.join(process.cwd(), "saved_games");

function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

export function saveGame(game: Game): string {
  ensureStorageDir();
  
  const filePath = path.join(STORAGE_DIR, `${game.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(game, null, 2));
  
  console.log(`[Storage] Saved game ${game.id} to ${filePath}`);
  return game.id;
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
    const game = JSON.parse(content) as Game;
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
