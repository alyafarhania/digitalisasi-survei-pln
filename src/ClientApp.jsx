'use client'
import dynamic from 'next/dynamic'
import { useEffect } from 'react'

// Seluruh aplikasi berjalan di browser (peta, IndexedDB, localStorage, offline) — tidak di-render di server.
const App = dynamic(() => import('./App'), { ssr: false, loading: () => <div className="gate"><p>Memuat aplikasi…</p></div> })

export default function ClientApp() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return <App />
}
