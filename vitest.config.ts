import { defineConfig } from 'vitest/config';

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
