import { defineConfig } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Ports the suite owns, kept clear of the app's default 3000. */
const APP_PORT = 3210;
const STUB_LLM_PORT = 3199;

/** Scratch space, so a test run cannot touch anybody's real campaigns. */
const SAVES_DIR = path.join(__dirname, "tests", "e2e", ".saves");
const ENV_FILE = path.join(__dirname, "tests", "e2e", ".env.e2e");

// Every run starts from an empty save directory — flow 6 asserts on what it
// wrote, and leftovers from a previous run would also be loaded at boot.
fs.rmSync(SAVES_DIR, { recursive: true, force: true });
fs.mkdirSync(SAVES_DIR, { recursive: true });

export default defineConfig({
  testDir: "./tests/e2e",
  // One worker: these flows share one server, and six smoke tests are quick
  // enough that the isolation is worth more than the parallelism.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  // The DM waits 5s before the opening scene, so a flow is inherently slow.
  timeout: 60_000,
  expect: { timeout: 20_000 },

  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },

  webServer: [
    {
      command: "node tests/e2e/stub-llm.mjs",
      port: STUB_LLM_PORT,
      env: { STUB_LLM_PORT: String(STUB_LLM_PORT) },
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
    },
    {
      // The browser needs compiled assets: index.html loads /js/app.ts, which
      // only Vite's build turns into something a browser can run.
      command: "npm run build && node dist/src/server.js",
      port: APP_PORT,
      env: { DND_ENV_FILE: ENV_FILE, DND_SAVED_GAMES_DIR: SAVES_DIR },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
    },
  ],
});
