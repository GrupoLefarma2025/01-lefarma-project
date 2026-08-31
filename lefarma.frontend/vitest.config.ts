/// <reference types="vitest" />
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Mirrors vite.config.ts: same `@` -> ./src alias and React plugin so test files
// resolve modules and transform JSX exactly like the real app build.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Keep Vitest from collecting the Playwright E2E suite (tests/** uses
    // @playwright/test and must run under its own runner, not Vitest).
    exclude: [...configDefaults.exclude, 'tests/**'],
  },
});
