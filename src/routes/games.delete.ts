import * as storage from "../utils/storage.js";
import type { Request, Response } from "express";

export default function gamesDeleteHandler(req: Request, res: Response) {
  const gameId = req.params.id;
  
  if (!gameId) {
    res.status(400).json({ error: "Game ID required" });
    return;
  }
  
  try {
    const deleted = storage.deleteGame(gameId);
    
    if (!deleted) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    
    // Also remove from memory if it exists there
    import("../game/store.js").then(({ gameStore }) => {
      gameStore.deleteGame(gameId);
    }).catch(() => {});
    
    res.json({ success: true, gameId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    res.status(500).json({ error: message });
  }
}
