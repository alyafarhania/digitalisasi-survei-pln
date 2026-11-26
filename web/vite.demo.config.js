// Build pratinjau (tanpa server dan tanpa PWA): VITE_DEMO=1 npx vite build -c vite.demo.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
export default defineConfig({
  base: './',
  resolve: { alias: { '@shared': path.resolve(__dirname, '../shared'), 'virtual:pwa-register': path.resolve(__dirname, 'src/lib/pwa-stub.js') } },
  plugins: [react()],
  build: { outDir: 'dist-demo', emptyOutDir: true, rollupOptions: { output: { entryFileNames: 'assets/app.js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' } } },
})
