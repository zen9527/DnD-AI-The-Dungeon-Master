import express from "express";
import { createServer } from "http";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

app.use(express.static(path.join(__dirname, "../public")));
app.use("/api", express.json());

import { WebSocketManager } from "./websocket/manager.js";
import { gameStore } from "./game/store.js";
import { configSchema } from "../shared/schemas/config.js";

const llmBaseUrl = process.env.LLM_API_URL || "http://localhost:1234/v1";
const llmModel = process.env.LLM_MODEL || "local-model";

const wsManager = new WebSocketManager(server);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// ---- Config API Routes ----

const envFilePath = path.join(__dirname, "../.env");

app.get("/api/config", (_req, res) => {
  res.json({
    llmBaseUrl: process.env.LLM_API_URL || "http://localhost:1234/v1",
    llmApiKey: process.env.LLM_API_KEY || "",
    llmModel: process.env.LLM_MODEL || "",
  });
});

app.post("/api/config", (req, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
    return;
  }

  const { llmBaseUrl, llmApiKey, llmModel } = parsed.data;

  // Read existing .env and update values
  let envContent = fs.readFileSync(envFilePath, "utf-8");

  envContent = envContent.replace(
    /^LLM_API_URL=.*/mi,
    `LLM_API_URL=${llmBaseUrl}`
  );
  envContent = envContent.replace(
    /^LLM_API_KEY=.*/mi,
    `LLM_API_KEY=${llmApiKey}`
  );
  envContent = envContent.replace(
    /^LLM_MODEL=.*/mi,
    `LLM_MODEL=${llmModel}`
  );

  fs.writeFileSync(envFilePath, envContent, "utf-8");

  console.log(`[Config] LLM updated: ${llmBaseUrl} (${llmModel})`);

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

  const { llmBaseUrl, llmApiKey, llmModel } = parsed.data;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (llmApiKey) headers["Authorization"] = `Bearer ${llmApiKey}`;

    const response = await fetch(`${llmBaseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: llmModel || "test",
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

server.listen(PORT, () => {
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
