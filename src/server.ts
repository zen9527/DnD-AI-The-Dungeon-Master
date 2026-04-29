import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env directly — bypass dotenv which depends on process.cwd()
const envPath = path.join(__dirname, "../..", ".env");
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [key, ...rest] = trimmed.split("=");
  if (key && rest.length > 0) envVars[key.trim()] = rest.join("=").trim();
}

console.log(`[Server] .env file: ${envPath}`);
console.log(`[Server] .env exists: ${fs.existsSync(envPath)}`);
console.log(`[Server] LLM_API_URL: ${envVars.LLM_API_URL || "(default: http://localhost:1234/v1)"}`);
console.log(`[Server] LLM_API_KEY: ${envVars.LLM_API_KEY ? "(set)" : "(not set)"}`);
console.log(`[Server] LLM_MODEL: ${envVars.LLM_MODEL || "(default: local-model)"}`);

// Set process.env for other modules
Object.assign(process.env, envVars);

const app = express();
const server = createServer(app);

app.use(express.static(path.join(__dirname, "../public")));
app.use("/api", express.json());

import { WebSocketManager } from "./websocket/manager.js";
import { gameStore } from "./game/store.js";
import { configSchema } from "../shared/schemas/config.js";

const llmBaseUrl = envVars.LLM_API_URL || "http://localhost:1234/v1";
const llmApiKey = envVars.LLM_API_KEY || null;
const llmModel = envVars.LLM_MODEL || "local-model";

const wsManager = new WebSocketManager(server);

const PORT = envVars.PORT || "3000";
const HOST = envVars.HOST || "0.0.0.0";

// ---- Config API Routes ----

const envFilePath = path.join(__dirname, "../..", ".env");

app.get("/api/config", (_req, res) => {
  res.json({
    llmBaseUrl: envVars.LLM_API_URL || "http://localhost:1234/v1",
    llmApiKey: envVars.LLM_API_KEY || "",
    llmModel: envVars.LLM_MODEL || "",
  });
});

app.post("/api/config", (req, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join("; ") });
    return;
  }

  const { llmBaseUrl: newBaseUrl, llmApiKey: newApiKey, llmModel: newModel } = parsed.data;

  let content = fs.readFileSync(envFilePath, "utf-8");
  content = content.replace(/^LLM_API_URL=.*/mi, `LLM_API_URL=${newBaseUrl}`);
  content = content.replace(/^LLM_API_KEY=.*/mi, `LLM_API_KEY=${newApiKey}`);
  content = content.replace(/^LLM_MODEL=.*/mi, `LLM_MODEL=${newModel}`);
  fs.writeFileSync(envFilePath, content, "utf-8");

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
