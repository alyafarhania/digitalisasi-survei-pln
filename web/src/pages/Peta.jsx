import { useState, useRef, useEffect } from 'react'
import { useApp, isTajam } from '../store'
import { dist } from '../lib/geo'
import MapView from '../components/MapView'
import AtributPanel from '../components/AtributPanel'
import Empty from './Empty'
import { maxSudut } from '../lib/konstruksi'
import { Icon } from '../components/ui'
import { RIGHT, buatSkema, SkemaIsi } from '../lib/skema'

function Inner({ go }) {
  const { active: project, update, online } = useApp()
  const [mode, setMode] = useState('titik')
  const [crossType, setCrossType] = useState('Jalan')
  const [running, setRunning] = useState(false)
  const [selId, setSelId] = useState(null)
  const [q, setQ] = useState('')
  const [fly, setFly] = useState(null)
  const [gps, setGps] = useState(null)
  const [msg, setMsg] = useState('')
  const mapRef = useRef(null)

  const idx = Math.max(0, project.points.findIndex((p) => p.id === selId))
  const adaTerpilih = project.points.some((p) => p.id === selId)
  const toast = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2800) }

  const addPoint = (ll) => {
    const id = crypto.randomUUID()
    update(project.id, (p) => ({ ...p, points: [...p.points, { id, lat: ll.lat, lng: ll.lng, nomor: `T${p.points.length + 1}`, jenisTiang: 'Tiang Beton 12M-350 daN+E', konduktor: 'AAAC 70 mm²', kondisi: 'Baru' }] }))
    setSelId(id)
  }
  const addCross = (ll) => {
    const label = window.prompt(`Nama ${crossType} (mis. Jl. Raya Klaten / SUTT 150 kV):`, '') || ''
    const tinggi = crossType === 'SUTT' ? window.prompt('Tinggi lintasan (m):', '') || '' : ''
    update(project.id, (p) => ({ ...p, crossings: [...p.crossings, { id: crypto.randomUUID(), type: crossType, label, tinggi, lat: ll.lat, lng: ll.lng }] }))
  }
  // Geser titik/penyeberangan yang sudah ditandai. Panjang manual di titik itu dan titik sesudahnya
  // dikosongkan agar dihitung ulang dari jarak baru.
  const movePoint = (id, ll, cross) => update(project.id, (p) => (cross
    ? { ...p, crossings: p.crossings.map((c) => (c.id === id ? { ...c, lat: ll.lat, lng: ll.lng } : c)) }
    : { ...p, points: p.points.map((x, i, arr) => (x.id === id ? { ...x, lat: ll.lat, lng: ll.lng, panjang: undefined } : arr[i - 1]?.id === id ? { ...x, panjang: undefined } : x)) }))
  const del = (id, cross) => update(project.id, (p) => (cross ? { ...p, crossings: p.crossings.filter((c) => c.id !== id) } : { ...p, points: p.points.filter((x) => x.id !== id) }))
  const change = (id, patch) => update(project.id, (p) => ({ ...p, points: p.points.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))

  const useGps = () => {
    if (!navigator.geolocation) return toast('GPS tidak tersedia di perangkat ini')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setGps(ll); setFly({ ...ll, zoom: 18 })
        if (running && mode === 'titik') addPoint(ll)
        else toast('Posisi ditemukan. Tekan Mulai untuk menandai titik dari GPS.')
      },
      () => toast('Gagal membaca GPS. Aktifkan izin lokasi (butuh HTTPS di HP).'), { enableHighAccuracy: true, timeout: 10000 })
  }
  const search = async (e) => {
    e.preventDefault()
    const m = q.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/)
    if (m) return setFly({ lat: +m[1], lng: +m[2], zoom: 18 })
    if (!online) return toast('Pencarian nama tempat butuh internet (koordinat tetap bisa)')
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`)
      const j = await r.json()
      j[0] ? setFly({ lat: +j[0].lat, lng: +j[0].lon, zoom: 17 }) : toast('Lokasi tidak ditemukan')
    } catch { toast('Pencarian gagal') }
  }
  const modes = [['titik', 'pin', 'Titik'], ['silang', 'layers', 'Silang'], ['hapus', 'trash', 'Hapus']]

  const total = project.points.reduce((a, p, i) => a + (i ? Math.round(dist(project.points[i - 1], p)) : 0), 0)
  const sk = buatSkema(project)
  const tajam = project.points.filter((p) => isTajam(project, p)).length
  const selectPoint = (id) => { setSelId(id); window.innerWidth < 1024 && setTimeout(() => document.getElementById('atribut')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }
  return (
    <>
      <div className="pg-h">
        <h1>Peta &amp; Tagging Titik</h1>
        <div className="actions"><button className="btn ghost" onClick={() => go('gambar')}>Lihat Gambar <Icon n="chevR" size={16} /></button></div>
        <p>Tekan <b>Mulai</b>, lalu ketuk peta atau gunakan posisi GPS untuk menambah titik tiang. Ketuk titik untuk mengisi atributnya (panel muncul di kanan peta). Tahan lalu geser titik untuk memindahkannya.</p>
      </div>
      <div className="split">
        <div>
          <div className="mapstage">
          <div className="rmap">
            <MapView project={project} selected={selId} onSelect={selectPoint} mode={mode} running={running}
              onAddPoint={addPoint} onAddCross={addCross} onDelete={del} onMove={movePoint} fly={fly} gpsPos={gps} mapRef={mapRef} />
            <div className="map-top">
              <form className="msearch" onSubmit={search}><Icon n="search" /><input placeholder="Cari lokasi (OpenStreetMap) atau koordinat…" aria-label="Cari lokasi" value={q} onChange={(e) => setQ(e.target.value)} /></form>
              <div className="mtools">
                {modes.map(([k, ic, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}><Icon n={ic} size={15} />{l}</button>)}
                {mode === 'silang' && <select value={crossType} onChange={(e) => setCrossType(e.target.value)}><option>Jalan</option><option>SUTT</option><option>Sungai</option></select>}
              </div>
            </div>
            {running && <div className="chip live">● {mode === 'titik' ? 'Ketuk peta untuk menambah titik' : mode === 'silang' ? `Ketuk peta untuk menandai ${crossType}` : 'Ketuk objek untuk menghapus'}</div>}
            <div className="map-bar">
              <i className={`rec ${running ? 'live' : ''}`} />
              <button className="btn sm" disabled={running} onClick={() => setRunning(true)}>Mulai</button>
              <button className="btn sm ghost" disabled={!running} onClick={() => { setRunning(false); toast('Tagging selesai. Lihat Gambar dan RAB.') }}>Selesai</button>
            </div>
            <div className="map-ctrl">
              <button className="fab" title="Tambah titik dari GPS" aria-label="Tambah titik dari GPS" onClick={useGps}><Icon n="nav" size={22} /></button>
              <button className="fab" title="Hapus titik terakhir" aria-label="Hapus titik terakhir" onClick={() => project.points.length && del(project.points[project.points.length - 1].id)}><Icon n="undo" size={22} /></button>
            </div>
            {msg && <div className="toast">{msg}</div>}
          </div>
          {adaTerpilih && (
            <div id="atribut" className="atr-float">
              <button type="button" className="atr-x" aria-label="Tutup panel atribut" title="Tutup" onClick={() => setSelId(null)}><Icon n="x" size={16} /></button>
              <AtributPanel project={project} index={idx} onIndex={(i) => setSelId(project.points[i].id)} onChange={change}
                onDelete={(id) => { del(id); toast('Titik dihapus') }} onSaved={() => toast('Titik tersimpan otomatis')} />
            </div>
          )}
          </div>
          <div className="stat-row">
            <div className="stat"><b>{project.points.length}</b><span>Titik tiang</span></div>
            <div className="stat"><b>{total.toLocaleString('id-ID')} m</b><span>Total jalur</span></div>
            <div className="stat"><b>{tajam}</b><span>Sudut &gt; {maxSudut(project.jalur)}°</span></div>
          </div>
          <details className="live-gambar" open>
            <summary><b>Gambar langsung</b><span>berubah otomatis mengikuti titik di peta · ketuk titik untuk memilih</span><button type="button" className="btn sm ghost" onClick={(e) => { e.preventDefault(); go('gambar') }}>Buka penuh</button></summary>
            {project.points.length < 2 ? <p className="empty" style={{ padding: 12 }}>Tandai minimal 2 titik di peta, gambar skematik muncul di sini.</p> : (
              <svg viewBox={`0 0 ${RIGHT - 10} ${sk.H}`} style={{ width: '100%', display: 'block', background: '#fff' }} fontFamily="Calibri, Arial, sans-serif">
                <rect x="3" y="3" width={RIGHT - 16} height={sk.H - 6} fill="none" stroke="#222" strokeWidth="1.5" />
                <image href="/kompas.jpg" x="10" y="10" width="62" height="64" />
                <SkemaIsi p={project} sk={sk} onSelect={selectPoint} selId={selId} />
              </svg>
            )}
          </details>
        </div>
      </div>
    </>
  )
}

export default function Peta({ go }) {
  const { active } = useApp()
  return active ? <Inner key={active.id} go={go} /> : <Empty go={go} judul="Peta & Tagging Titik" />
}