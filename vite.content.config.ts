import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

// Content scripts can NOT be ES modules (MV3). Build a single IIFE bundle
// into the same dist/ directory (do NOT empty it).
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2022',
    rollupOptions: {
      input: { content: resolve(rootDir, 'src/content/index.ts') },
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'content.js',
      },
    },
  },
});
