import * as storage from "../utils/storage.js";
import type { Request, Response } from "express";

export default async function gamesLoadGetHandler(req: Request, res: Response) {
  const gameId = req.params.id;
  
  if (!gameId) {
    res.status(400).json({ error: "Game ID required" });
    return;
  }
  
  try {
    const game = storage.loadGame(gameId);
    
    if (!game) {
      res.status(404).json({ error: "Game not found" });
      return;
    }
    
    res.json({ success: true, game });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Load failed";
    res.status(500).json({ error: message });
  }
}
