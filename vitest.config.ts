import fs from "fs";
import os from "os";
import path from "path";
import { defineConfig } from 'vitest/config';

// Anything a test persists — saves, session tokens — lands in a throwaway
// directory, never in the developer's real saved_games/. Workers inherit this
// because it is set before Vitest forks them.
process.env.DND_SAVED_GAMES_DIR ||= fs.mkdtempSync(path.join(os.tmpdir(), "dnd-test-saves-"));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000, // Increased from default 5000ms to handle timer tests
    hookTimeout: 15000,
    // tests/e2e belongs to Playwright — Vitest would try to run the browser
    // specs and fail on the `@playwright/test` runner import.
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
  },
});
