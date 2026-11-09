import { useEffect, useState } from 'react'
import { Provider, useApp } from './store'
import { Icon, Logo } from './components/ui'
import Data from './pages/Data'
import Offline from './pages/Offline'
import Ekspor from './pages/Ekspor'
import Peta from './pages/Peta'
import Proyek from './pages/Proyek'
import Gambar from './pages/Gambar'
import Rab from './pages/Rab'
import { loadMaster } from './lib/konstruksi'

const NAV = [['data', 'sheet', 'Data Pelanggan', 'Data'], ['peta', 'pin', 'Peta & Tagging', 'Peta'], ['gambar', 'poles', 'Gambar Skematik', 'Gambar'], ['rab', 'sheet', 'Material & RAB', 'RAB'],
  ['project', 'folder', 'Project', 'Project'], ['offline', 'wifioff', 'Offline & Sinkron', 'Offline'], ['ekspor', 'download', 'Foto & Ekspor', 'Ekspor']]

function SyncPill() {
  const { online, serverUp, syncing, pending } = useApp()
  const [s, label] = !online ? ['off', 'Offline'] : syncing ? ['busy', 'Menyinkronkan…'] : pending ? ['wait', `${pending} menunggu sinkron`] : serverUp ? ['ok', 'Online · Tersinkron'] : ['wait', 'Server belum terjangkau']
  return <span className={`pill sync ${s}`}><i />{label}</span>
}

function ConflictModal() {
  const { conflict, active, resolve } = useApp()
  if (!conflict) return null
  const s = conflict.server
  return (
    <div className="modal-back">
      <div className="modal">
        <div className="modal-h"><h3>Project diubah di perangkat lain</h3></div>
        <p style={{ margin: 0 }}>Project <b>{s.nomor}</b> ({s.nama}) sudah berubah di server sejak Anda terakhir sinkron. Pilih satu versi yang dipakai.</p>
        <div className="infobox"><b>Versi server:</b> {s.points.length} titik, versi {s.version}<br /><b>Versi di perangkat ini:</b> perubahan Anda yang belum terkirim</div>
        <div className="modal-f stack">
          <button className="btn primary" onClick={() => resolve('lokal')}>Pakai versi saya (timpa server)</button>
          <button className="btn ghost" onClick={() => resolve('server')}>Pakai versi server (buang perubahan saya)</button>
        </div>
      </div>
    </div>
  )
}

function Shell() {
  const [view, setView] = useState({ page: 'data', opt: null })
  const go = (page, opt = null) => { setView({ page, opt }); window.scrollTo?.(0, 0) }
  const pages = { data: Data, peta: Peta, gambar: Gambar, rab: Rab, project: Proyek, offline: Offline, ekspor: Ekspor }
  const Page = pages[view.page]
  return (
    <div className="rapp">
      <header className="rhdr">
        <div className="rbrand">
          <div className="logo-wrap"><img src="/logo-icon.png" alt="Logo PLN" /></div>
          <div className="rbrand-t"><b><span className="t-s">Survei TD &amp; PB</span><span className="t-l">Survei Tambah Daya &amp; Pasang Baru</span></b><span>Survey Pasang Baru &amp; Tambah Daya</span></div>
        </div>
        <div className="rhdr-r"><SyncPill /><span className="rhdr-user">Divisi Perencanaan</span></div>
      </header>
      <div className="rshell">
        <nav className="rside" aria-label="Menu utama">
          <h4>Alur Kerja</h4>
          {NAV.map(([k, ic, l]) => <button key={k} className={view.page === k ? 'on' : ''} onClick={() => go(k)}><Icon n={ic} size={20} /> {l}</button>)}
        </nav>
        <main className="rmain"><Page key={view.page + (view.opt || '')} go={go} opt={view.opt} />
          <p className="foot">PT PLN (Persero) · UP3 Klaten · Divisi Perencanaan</p></main>
      </div>
      <nav className="rbottom">
        {NAV.map(([k, ic, , s]) => <button key={k} className={view.page === k ? 'on' : ''} onClick={() => go(k)}><Icon n={ic} size={22} /><span>{s}</span></button>)}
      </nav>
      <ConflictModal />
    </div>
  )
}

function Gate() {
  const [st, setSt] = useState('load')
  const run = () => { setSt('load'); loadMaster().then((r) => setSt(r.ok ? 'ok' : 'err')) }
  useEffect(run, [])
  if (st === 'ok') return <Provider><Shell /></Provider>
  return (
    <div className="gate">
      <Logo />
      {st === 'load' ? <p>Memuat data master…</p> : <>
        <p><b>Data master belum tersedia.</b><br />Server belum terhubung dan belum ada salinan di perangkat ini. Pastikan server berjalan dan data Excel sudah diimpor, lalu coba lagi.</p>
        <button className="btn primary" onClick={run}>Coba lagi</button>
      </>}
    </div>
  )
}
export default function App() { return <Gate /> }