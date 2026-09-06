import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The tracker is consumed by its package name so the app path is the
      // same one an outside project would use. One install, no build step.
      '@froola/handtrack': fileURLToPath(new URL('./packages/handtrack/src/index.ts', import.meta.url)),
    },
  },
  server: {
    // api/ routes aren't served by plain `vite` — forward them to
    // `vercel dev` (run separately, e.g. `vercel dev --listen 3001`) which
    // hosts the serverless functions. Avoids running the app itself through
    // vercel dev's own routing layer, which mishandles the SPA rewrite
    // against Vite's dev-server asset/module requests.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'supabase', test: /node_modules[/\\]@supabase/ },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
