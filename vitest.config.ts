import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test-utils/webAudioMock.ts', 'src/test-setup.ts'],
    // .claude/ holds scratch git worktrees (other branches' checkouts);
    // their test files must not run as part of this tree's suite.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
