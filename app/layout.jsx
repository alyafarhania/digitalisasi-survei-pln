import '../src/styles/styles.css'
import '../src/styles/ref.css'
import '../src/styles/design.css'
import ClientApp from '../src/ClientApp'

export const metadata = {
  title: 'Survei Tambah Daya & Pasang Baru',
  description: 'Survei di HP, gambar skematik dan RAB otomatis, ekspor Excel. PT PLN (Persero) UP3 Klaten.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
}
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0A5C94' }

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        {/* Aplikasi ada di layout agar tidak di-mount ulang saat alamat berubah (state, sinkron, dan master tetap hidup) */}
        {/* tautan lama #/p/<kode>: kode diamankan sebelum router Next menghapus hash */}
        <script dangerouslySetInnerHTML={{ __html: "try{var m=/^#\\/p\\/([A-Za-z0-9_-]{8,32})/.exec(location.hash);if(m)sessionStorage.setItem('pln-legacy-kode',m[1])}catch(e){}" }} />
        <ClientApp />
        {children}
      </body>
    </html>
  )
}
