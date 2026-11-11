import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          include: ['server/tests/**/*.test.ts'],
          environment: 'node',
          globals: false,
        },
      },
      {
        test: {
          name: 'web',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          environment: 'jsdom',
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['server/src/**/*.ts', 'src/**/*.{ts,tsx}'],
      exclude: ['**/*.d.ts'],
    },
  },
})
