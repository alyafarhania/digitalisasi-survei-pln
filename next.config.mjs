/** @type {import('next').NextConfig} */
export default {
  output: 'standalone', // image Docker kecil: server.js + node_modules yang dipakai saja
  reactStrictMode: false, // Leaflet + efek dengan side-effect: hindari init ganda saat dev
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] },
    ]
  },
}
