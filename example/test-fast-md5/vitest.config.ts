import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['e2e/**/*.test.ts'],
    testTimeout: 600_000,
    hookTimeout: 120_000,
    environment: 'node',
    globalSetup: ['e2e/global-setup.ts'],
    // These are Node.js deps that Vite should not try to bundle
    server: {
      deps: {
        external: ['playwright'],
      },
    },
  },
})
