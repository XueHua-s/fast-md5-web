import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['__test/**/*.test.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
})
