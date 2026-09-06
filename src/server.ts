import { log } from "./utils/logger.js";
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { configManager } from "./utils/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = configManager.read();

log.info(`[Server] .env file: ${configManager.getEnvPath()}`);
log.info(`[Server] .env exists: ${fs.existsSync(configManager.getEnvPath())}`);
log.info(`[Server] LLM provider: ${config.llmProvider}`);
log.info(`[Server] LLM_API_URL: ${config.llmBaseUrl}`);
log.info(`[Server] LLM_API_KEY: ${config.llmApiKey ? "(set)" : "(not set)"}`);
log.info(`[Server] LLM_MODEL: ${config.llmModel}`);

// Set process.env for other modules (backward compatibility)
Object.assign(process.env, {
  LLM_API_URL: config.llmBaseUrl,
  LLM_API_KEY: config.llmApiKey ?? "",
  LLM_MODEL: config.llmModel,
  PORT: config.port,
  HOST: config.host,
});

const app = express();
const server = createServer(app);

// In production, serve Vite-built assets from dist/public/
// In dev (when running node dist/src/server.js directly), fall back to public/
const distPublic = path.join(__dirname, "../dist/public");
const srcPublic = path.join(__dirname, "../public");
app.use(express.static(fs.existsSync(distPublic) && fs.existsSync(path.join(distPublic, "assets")) ? distPublic : srcPublic));
app.use("/api", express.json());

import { WebSocketManager } from "./websocket/manager.js";
import { gameStore } from "./game/store.js";
import gamesSavePostHandler from "./routes/games.save.post.js";
import gamesDeleteHandler from "./routes/games.delete.js";
import { getConfigHandler, postConfigTestHandler } from "./routes/config.js";
import { listGames as listSavedGames } from "./utils/storage.js";


const wsManager = new WebSocketManager(server);

// Load saved games from disk into memory at startup
gameStore.loadSavedGames();
log.info(`[GameStore] Loaded ${gameStore.getGameCount()} game(s) from storage`);

// Start auto-save every 60 seconds
gameStore.startAutoSave();

const PORT = config.port;
const HOST = config.host;

// ---- Config API Routes ----

app.get("/api/config", getConfigHandler);
app.post("/api/config/test", postConfigTestHandler);

// ---- Save/Load Game API Routes ----

app.post("/api/games/:id/save", gamesSavePostHandler);

// ---- Saved Games API Route ----

app.get("/api/saved-games", (_req, res) => {
  try {
    const saved = listSavedGames();
    res.json(saved);
  } catch (error) {
    log.error("[API] Failed to list saved games:", error);
    res.status(500).json({ error: "Failed to list saved games" });
  }
});

app.delete("/api/saved-games/:id", gamesDeleteHandler);

server.listen(parseInt(PORT), () => {
  log.info(`============================================`);
  log.info(`DnD AI: The Dungeon Master running at http://${HOST}:${PORT}`);
  log.info(`LLM: ${config.llmProvider} — ${config.llmModel}`);
  log.info(`Press Ctrl+C to stop`);
  log.info(`============================================`);
});

// Catch unhandled promise rejections for debugging
process.on("unhandledRejection", (reason, promise) => {
  log.error(`[Global] Unhandled Rejection at:`, promise);
  log.error(`[Global] Reason:`, reason instanceof Error ? reason.message : reason);
  log.error(`[Global] Stack:`, reason instanceof Error ? reason.stack : "N/A");
});

process.on("SIGINT", () => {
  log.info("\nShutting down server...");
  wsManager.shutdown();
  server.close(() => {
    log.info("Server closed");
    process.exit(0);
  });
});
