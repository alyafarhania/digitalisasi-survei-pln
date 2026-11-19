export default function manifest() {
  return {
    name: 'Perencanaan Pasang Baru & Tambah Daya', short_name: 'Survei PLN', lang: 'id', start_url: '/', display: 'standalone',
    theme_color: '#0A5C94', background_color: '#ffffff',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
  }
}
