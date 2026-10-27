import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { outDir: 'dist' },
  test: {
    environment: 'node', include: ['tests/**/*.test.js'], globals: false,
    // Vitest 5 keeps compiled test modules on disk between runs. Now and then that cache went stale and every test
    // file failed with "Cannot read properties of undefined (reading 'config')" until it was rebuilt. The suite runs
    // in about a second, so the cache buys nothing.
    fsModuleCache: false,
    cache: false,
  },
});
