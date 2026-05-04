import { gameStore } from "../game/store.js";
import * as storage from "../utils/storage.js";
import type { Request, Response } from "express";

export default async function gamesSavePostHandler(req: Request, res: Response) {
  const gameId = req.params.id;
  
  if (!gameId) {
    res.status(400).json({ error: "Game ID required" });
    return;
  }
  
  const engine = gameStore.getGame(gameId);
  
  if (!engine) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  
  try {
    storage.saveGame(engine.game);
    res.json({ success: true, gameId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed";
    res.status(500).json({ error: message });
  }
}
