import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: resolve(rootDir, 'src'),
  base: './',
  publicDir: resolve(rootDir, 'public'),
  build: {
    outDir: resolve(rootDir, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2022',
    rollupOptions: {
      input: {
        sw: resolve(rootDir, 'src/background/sw.ts'),
        popup: resolve(rootDir, 'src/popup/index.html'),
        options: resolve(rootDir, 'src/options/index.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'popup') return 'popup/popup.js';
          if (chunkInfo.name === 'options') return 'options/options.js';
          return '[name].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
