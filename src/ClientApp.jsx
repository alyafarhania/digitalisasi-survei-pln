'use client'
import dynamic from 'next/dynamic'
import { useEffect } from 'react'

// Seluruh aplikasi berjalan di browser (peta, IndexedDB, localStorage, offline) — tidak di-render di server.
const App = dynamic(() => import('./App'), { ssr: false, loading: () => <div className="gate"><p>Memuat aplikasi…</p></div> })

export default function ClientApp() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => {})
    else {
      // mode dev: buang service worker & cache sisa build produksi di alamat yang sama agar tidak menyajikan file lama
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {})
      if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {})
    }
  }, [])
  return <App />
}
