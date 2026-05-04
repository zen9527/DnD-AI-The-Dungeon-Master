import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000, // Increased from default 5000ms to handle timer tests
    hookTimeout: 15000,
  },
});
