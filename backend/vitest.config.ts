import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30_000,  // single Supabase round-trip is ~200ms; 30s covers slow CI
    hookTimeout: 60_000,  // beforeAll seeds several Auth accounts concurrently
    sequence: {
      concurrent: false,  // test files share a Supabase instance — run sequentially
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include:  ['src/**/*.ts'],
      exclude:  ['src/server.ts'],
    },
  },
})