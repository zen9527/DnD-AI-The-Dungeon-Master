import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { configManager } from "./utils/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = configManager.read();

console.log(`[Server] .env file: ${configManager.getEnvPath()}`);
console.log(`[Server] .env exists: ${fs.existsSync(configManager.getEnvPath())}`);
console.log(`[Server] LLM_API_URL: ${config.llmBaseUrl}`);
console.log(`[Server] LLM_API_KEY: ${config.llmApiKey ? "(set)" : "(not set)"}`);
console.log(`[Server] LLM_MODEL: ${config.llmModel}`);

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

app.use(express.static(path.join(__dirname, "../public")));
app.use("/api", express.json());

import { WebSocketManager } from "./websocket/manager.js";
import { gameStore } from "./game/store.js";
import { configSchema } from "../shared/schemas/config.js";

// Use config from ConfigManager (already loaded above)
const llmBaseUrl = config.llmBaseUrl;
const llmApiKey = config.llmApiKey;
const llmModel = config.llmModel;

const wsManager = new WebSocketManager(server);

const PORT = config.port;
const HOST = config.host;

// ---- Config API Routes ----

app.get("/api/config", (_req, res) => {
  const config = configManager.read();
  res.json({
    llmBaseUrl: config.llmBaseUrl,
    llmApiKey: config.llmApiKey || "",
    llmModel: config.llmModel,
  });
});

app.post("/api/config", (req, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
    return;
  }

  const { llmBaseUrl: newBaseUrl, llmApiKey: newApiKey, llmModel: newModel } = parsed.data;

  configManager.write({ llmBaseUrl: newBaseUrl, llmApiKey: newApiKey, llmModel: newModel });

  console.log(`[Config] LLM updated: ${newBaseUrl} (${newModel})`);
  res.json({ success: true, restartRequired: true });
});

app.get("/api/config/models", async (req, res) => {
  const baseUrl = req.query.url as string;
  const apiKey = req.query.key as string;

  if (!baseUrl) {
    res.json({ models: [] });
    return;
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const response = await fetch(`${baseUrl}/models`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      res.json({ models: [], error: `HTTP ${response.status}` });
      return;
    }

    const data = await response.json() as { data?: { id: string }[] };
    const models = data.data?.map(m => m.id) || [];
    res.json({ models, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.json({ models: [], error: `Failed to fetch models: ${message}` });
  }
});

app.post("/api/config/test", async (req, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
    return;
  }

  const { llmBaseUrl: testBaseUrl, llmApiKey: testApiKey, llmModel: testModel } = parsed.data;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (testApiKey) headers["Authorization"] = `Bearer ${testApiKey}`;

    const response = await fetch(`${testBaseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: testModel || "test",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      res.json({ connected: true, message: "LLM endpoint reachable" });
    } else {
      const text = await response.text();
      res.json({ connected: false, message: `HTTP ${response.status}: ${text.substring(0, 200)}` });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.json({ connected: false, message: `Connection failed: ${message}` });
  }
});

server.listen(parseInt(PORT), () => {
  console.log(`============================================`);
  console.log(`DnD Full Auto-DM Server running at http://${HOST}:${PORT}`);
  console.log(`LLM: ${llmBaseUrl} (${llmModel})`);
  console.log(`Press Ctrl+C to stop`);
  console.log(`============================================`);
});

process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  wsManager.shutdown();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
