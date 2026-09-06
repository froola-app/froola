import { fileURLToPath } from 'node:url'
import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Same alias the app and Vite use, so tests exercise the real import path.
      '@froola/handtrack': fileURLToPath(new URL('./packages/handtrack/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test-utils/webAudioMock.ts', 'src/test-setup.ts'],
    // .claude/ holds scratch git worktrees (other branches' checkouts);
    // their test files must not run as part of this tree's suite.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
