import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  base: '/assets/editor/visual/',
  publicDir: false,
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: resolve(root, '../static/visual'),
    emptyOutDir: true,
    manifest: true,
    sourcemap: false,
    minify: true,
    rollupOptions: {
      input: resolve(root, 'src/main.js'),
      output: {
        entryFileNames: 'visual-editor.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (asset) => asset.name?.endsWith('.css')
          ? 'visual-editor.css'
          : '[name]-[hash][extname]',
      },
    },
  },
});
