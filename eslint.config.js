import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // .claude/worktrees holds full nested checkouts (each with its own
  // tsconfig.json) for in-progress branch work — without this, typescript-eslint
  // finds multiple candidate tsconfig root dirs and refuses to parse anything.
  // optional/ is parked reference code (see optional/billing/README.md): it is
  // not part of the app, keeps the import paths of where it used to live, and
  // is deliberately not built, type-checked, or linted.
  globalIgnores(['dist', '.claude/**', 'optional/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
])
