import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

const API = process.env.API_URL || 'http://localhost:3000'
export default defineConfig({
  resolve: { alias: { '@shared': path.resolve(__dirname, '../shared') } },
  server: { port: 5173, fs: { allow: ['..'] }, proxy: { '/api': API, '/socket.io': { target: API, ws: true } } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-pln.png', 'kompas.jpg'],
      manifest: {
        name: 'Perencanaan Pasang Baru & Tambah Daya', short_name: 'Survei PLN', lang: 'id', theme_color: '#0A5C94', background_color: '#ffffff', display: 'standalone',
        icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
      },
      workbox: { navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/], globPatterns: ['**/*.{js,css,html,png,jpg,svg}'], maximumFileSizeToCacheInBytes: 4_000_000 },
    }),
  ],
})
