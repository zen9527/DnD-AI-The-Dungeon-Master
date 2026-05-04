import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Frontend tests that require DOM should be in tests/frontend/ and use jsdom
    // But since jsdom is not installed, we'll use node for all tests
  },
});
