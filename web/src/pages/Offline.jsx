import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { tileList, downloadTiles, countTiles, clearTiles } from '../lib/offlineTiles'

// F8 Offline dan sinkron: unduh area peta (radius 2 sampai 5 km) dan lihat antrean sinkron
export default function Offline() {
  const { state, active, online, serverUp, syncing } = useApp()
  const [radius, setRadius] = useState(2), [stored, setStored] = useState(0), [dl, setDl] = useState(null), [msg, setMsg] = useState('')
  const abort = useRef(null)
  const center = active?.points?.[0] || { lat: -7.7059, lng: 110.6016 }
  useEffect(() => { countTiles().then(setStored) }, [dl])
  const urls = tileList(center, radius * 1000)
  const unduh = async () => {
    if (!online) return setMsg('Butuh internet untuk mengunduh area.')
    setMsg(''); abort.current = new AbortController(); setDl({ done: 0, total: urls.length, fail: 0 })
    const r = await downloadTiles(urls, (done, total, fail) => setDl({ done, total, fail }), abort.current.signal)
    setDl(null); setMsg(r.fail ? `Selesai, ${r.fail} tile gagal diunduh.` : `Area ${radius} km tersimpan untuk dipakai offline.`)
  }
  return (
    <>
      <div className="pg-h"><h1>Offline &amp; Sinkron</h1><p>Unduh area survei sebelum berangkat. Peta dan tagging tetap berjalan tanpa sinyal; data tersimpan otomatis saat jaringan kembali.</p></div>
      <div className="two-col">
        <div className="card">
          <div className="card-h"><h2>Unduh area peta</h2><span className="sub">{stored.toLocaleString('id-ID')} tile tersimpan</span></div>
          <div className="card-b stack">
            <div className="fld"><label>Pusat area</label><input className="rin" readOnly value={`${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}${active?.points?.[0] ? ` (${active.points[0].nomor || 'titik pertama'})` : ' (Klaten, belum ada titik)'}`} /></div>
            <div className="fld"><label>Radius unduhan: <b>{radius} km</b></label>
              <input type="range" className="range" min="2" max="5" step="1" value={radius} onChange={(e) => setRadius(+e.target.value)} />
              <span className="hint">Maksimal 2–5 km per project agar HP tidak lag.</span></div>
            <div className="progress"><i style={{ width: dl ? `${(dl.done / dl.total) * 100}%` : '0%' }} /></div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {dl ? <button className="btn ghost" onClick={() => abort.current?.abort()}>Batal</button> : <button className="btn" disabled={!online} onClick={unduh}>Unduh area</button>}
              <button className="btn ghost" disabled={!!dl} onClick={async () => { await clearTiles(); setStored(0); setMsg('Peta offline dihapus.') }}>Hapus tersimpan</button>
              <span style={{ fontSize: 13 }}>{dl ? `Mengunduh ${dl.done}/${dl.total}…` : `Estimasi ± ${(urls.length * 0.02).toFixed(0)} MB · ${urls.length.toLocaleString('id-ID')} tile`}</span>
            </div>
            {msg && <p className="hint" style={{ margin: 0 }}>{msg}</p>}
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h2>Antrean sinkron</h2>
            <span className={`chip2 ${!online ? 'off' : serverUp ? 'ok' : 'wait'}`} style={{ marginLeft: 'auto' }}>{!online ? 'Offline' : syncing ? 'Menyinkronkan…' : serverUp ? 'Online' : 'Server belum terjangkau'}</span></div>
          <div className="card-b">
            <ul className="queue">
              {state.projects.filter((p) => p.dirty || !p.version).map((p) => (
                <li key={p.id}><span>{p.nomor} · {p.nama}</span><span className={`chip2 wait`}>{!p.version ? 'Belum terkirim' : 'Menunggu'}</span></li>
              ))}
              {!state.projects.some((p) => p.dirty || !p.version) && <li><span>Semua perubahan sudah tersinkron</span><span className="chip2 ok">Selesai</span></li>}
            </ul>
            <p className="hint" style={{ marginTop: 12 }}>Jika project yang sama diedit di dua perangkat, akan muncul pop-up untuk memilih versi yang dipakai saat HP kembali online.</p>
          </div>
        </div>
      </div>
    </>
  )
}
