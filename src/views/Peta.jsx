import { useState, useRef, useEffect } from 'react'
import { useApp, isTajam } from '../store'
import { useAuth } from '../lib/authContext'
import { dist } from '../lib/geo'
import MapView from '../components/MapView'
import AtributPanel from '../components/AtributPanel'
import Empty from './Empty'
import { BATAS_SUDUT_DALAM } from '../lib/tajam'
import PetaOfflinePanel from '../components/PetaOfflinePanel'
import { Icon } from '../components/ui'
import { KLATEN, LEBAR_AWAL_M, boundsOf, buatPetaOffline, petaAktif, petaDel, petaPut, siapkanGambar, ubahPeta, useGambarPeta } from '../lib/petaOffline'

function Inner({ go }) {
  const { active: project, update, online, markGuide } = useApp()
  const ro = !useAuth().canEdit(project)
  const [mode, setMode] = useState('titik')
  const [jalur, setJalur] = useState('baru') // jalur aktif: 'baru' = pemasangan (merah), 'bongkar' = pembongkaran (ungu)
  const [crossType, setCrossType] = useState('Jalan')
  const [running, setRunning] = useState(false)
  const [selId, setSelId] = useState(null)
  const [q, setQ] = useState('')
  const [fly, setFly] = useState(null)
  const [pin, setPin] = useState(null)
  const [gps, setGps] = useState(null)
  const [msg, setMsg] = useState('')
  const mapRef = useRef(null)
  const [panel, setPanel] = useState(false), [busyPeta, setBusyPeta] = useState(false)
  const [kal, setKal] = useState(false), [calPts, setCalPts] = useState([])
  const po = petaAktif(project)
  const { url: poUrl, hilang } = useGambarPeta(project.petaOffline)
  const offline = po ? { id: po.id, url: poUrl, bounds: boundsOf(po) } : null

  const ptsB = project.pointsBongkar || []
  const terpilihB = ptsB.some((p) => p.id === selId)
  const daftarSel = terpilihB ? ptsB : project.points // daftar titik pada jalur titik yang dipilih
  const idx = Math.max(0, daftarSel.findIndex((p) => p.id === selId))
  const adaTerpilih = project.points.some((p) => p.id === selId) || terpilihB
  const toast = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2800) }

  // Titik baru otomatis tersambung ke titik terakhir pada jalur yang dipilih (merah: pemasangan, ungu: pembongkaran)
  const addPoint = (ll) => {
    const id = crypto.randomUUID(), b = jalur === 'bongkar'
    update(project.id, (p) => (b
      ? { ...p, pointsBongkar: [...(p.pointsBongkar || []), { id, lat: ll.lat, lng: ll.lng, nomor: `B${(p.pointsBongkar || []).length + 1}`, jenisTiang: 'Tiang Beton 12M-350 daN+E', konduktor: 'AAAC 70 mm²', kondisi: 'Bongkar' }] }
      : { ...p, points: [...p.points, { id, lat: ll.lat, lng: ll.lng, nomor: `T${p.points.length + 1}`, jenisTiang: 'Tiang Beton 12M-350 daN+E', konduktor: 'AAAC 70 mm²', kondisi: 'Baru' }] }))
    setSelId(id)
  }
  const addCross = (ll) => {
    const label = window.prompt(`Nama ${crossType} (contoh Jl. Raya Klaten / SUTT 150 kV):`, '') || ''
    const tinggi = crossType === 'SUTT' ? window.prompt('Tinggi lintasan (m):', '') || '' : ''
    update(project.id, (p) => ({ ...p, crossings: [...p.crossings, { id: crypto.randomUUID(), type: crossType, label, tinggi, lat: ll.lat, lng: ll.lng }] }))
  }
  // Geser titik/penyeberangan yang sudah ditandai. Panjang manual di titik itu dan titik sesudahnya
  // dikosongkan agar dihitung ulang dari jarak baru.
  const geserTitik = (id, ll) => (x, i, arr) => (x.id === id ? { ...x, lat: ll.lat, lng: ll.lng, panjang: undefined } : arr[i - 1]?.id === id ? { ...x, panjang: undefined } : x)
  const movePoint = (id, ll, cross) => update(project.id, (p) => (cross
    ? { ...p, crossings: p.crossings.map((c) => (c.id === id ? { ...c, lat: ll.lat, lng: ll.lng } : c)) }
    : { ...p, points: p.points.map(geserTitik(id, ll)), ...(p.pointsBongkar ? { pointsBongkar: p.pointsBongkar.map(geserTitik(id, ll)) } : {}) }))
  // kedua jalur dikelola terpisah: hapus/ubah mencari titik di jalur mana pun
  const del = (id, cross) => update(project.id, (p) => (cross ? { ...p, crossings: p.crossings.filter((c) => c.id !== id) } : { ...p, points: p.points.filter((x) => x.id !== id), ...(p.pointsBongkar ? { pointsBongkar: p.pointsBongkar.filter((x) => x.id !== id) } : {}) }))
  const change = (id, patch) => update(project.id, (p) => ({ ...p, points: p.points.map((x) => (x.id === id ? { ...x, ...patch } : x)), ...(p.pointsBongkar ? { pointsBongkar: p.pointsBongkar.map((x) => (x.id === id ? { ...x, ...patch, kondisi: 'Bongkar' } : x)) } : {}) }))
  const hapusTerakhir = () => { const arr = jalur === 'bongkar' ? ptsB : project.points; arr.length && del(arr[arr.length - 1].id) }


  // ---- peta offline unggahan
  const pusatAwal = () => {
    const pts = project.points
    if (pts.length) return { lat: (Math.min(...pts.map((x) => x.lat)) + Math.max(...pts.map((x) => x.lat))) / 2, lng: (Math.min(...pts.map((x) => x.lng)) + Math.max(...pts.map((x) => x.lng))) / 2 }
    const c = mapRef.current?.getCenter?.(); return c ? { lat: c.lat, lng: c.lng } : KLATEN
  }
  const unggahPeta = async (file) => {
    setBusyPeta(true)
    try {
      const g = await siapkanGambar(file), lama = project.petaOffline
      const pts = project.points
      const ext = pts.length > 1 ? Math.max(dist(pts[0], pts[pts.length - 1]), ...pts.map((x) => dist(pts[0], x))) : 0
      const baru = buatPetaOffline(file, g, pusatAwal(), lama?.widthM || (ext ? Math.max(LEBAR_AWAL_M, Math.round(ext * 2.2)) : LEBAR_AWAL_M))
      await petaPut(baru.id, g.blob); lama && petaDel(lama.id)
      update(project.id, (p) => ({ ...p, petaOffline: baru }))
      toast('Peta offline dipasang. Atur skala sebelum menandai titik.')
    } catch { toast('Gagal membaca gambar. Pakai file JPG, PNG, atau WebP.') } finally { setBusyPeta(false) }
  }
  const ubahPetaOff = (patch) => update(project.id, (p) => ubahPeta(p, patch))
  const hapusPeta = () => {
    if (!window.confirm('Hapus peta offline dari project ini? Titik yang sudah ditandai tetap ada.')) return
    const id = project.petaOffline?.id
    update(project.id, (p) => { const { petaOffline, ...rest } = p; return rest }); id && petaDel(id); setPanel(false); toast('Peta offline dihapus. Kembali memakai peta online.')
  }
  const mulaiKalibrasi = () => { setPanel(false); setKal(true); setCalPts([]); toast('Ketuk dua titik di peta yang jaraknya Anda ketahui (mis. ujung skala peta).') }
  const onKalibrasi = (ll) => {
    const arr = [...calPts, ll]; setCalPts(arr)
    if (arr.length < 2 || !po) return
    const terukur = dist(arr[0], arr[1])
    setTimeout(() => {
      const v = window.prompt(`Jarak sebenarnya kedua titik di lapangan (meter)?\nTerukur di peta saat ini: ${Math.round(terukur)} m`, '')
      const nyata = parseFloat(String(v || '').replace(',', '.'))
      if (nyata > 0 && terukur > 0) { ubahPetaOff({ widthM: Math.round(po.widthM * (nyata / terukur) * 10) / 10 }); toast('Skala peta offline dikalibrasi.') }
      setKal(false); setCalPts([])
    }, 60)
  }

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
    if (!q.trim()) return setPin(null)
    if (m) { setPin({ lat: +m[1], lng: +m[2], nama: `${(+m[1]).toFixed(5)}, ${(+m[2]).toFixed(5)}` }); return setFly({ lat: +m[1], lng: +m[2], zoom: 18 }) }
    if (!online) return toast('Pencarian nama tempat butuh internet (koordinat tetap bisa)')
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`)
      const j = await r.json()
      if (!j[0]) return toast('Lokasi tidak ditemukan')
      setPin({ lat: +j[0].lat, lng: +j[0].lon, nama: j[0].name || String(j[0].display_name || q).split(',')[0] || q.trim() })
      setFly({ lat: +j[0].lat, lng: +j[0].lon, zoom: 17 })
    } catch { toast('Pencarian gagal') }
  }
  const modes = [['titik', 'pin', 'Titik'], ['silang', 'layers', 'Silang'], ['hapus', 'trash', 'Hapus']]

  const panjangJalur = (arr) => arr.reduce((a, p, i) => a + (i ? Math.round(dist(arr[i - 1], p)) : 0), 0)
  const total = panjangJalur(project.points), totalB = panjangJalur(ptsB)
  const tajam = project.points.filter((p) => isTajam(project, p)).length
  const selectPoint = (id) => { setSelId(id); setJalur(ptsB.some((x) => x.id === id) ? 'bongkar' : 'baru'); window.innerWidth < 1024 && setTimeout(() => document.getElementById('atribut')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }
  return (
    <>
      <div className="pg-h">
        <h1>Peta &amp; Tagging Titik</h1>
        <div className="actions">
          <button className={`btn ghost ${po ? 'on' : ''}`} onClick={() => setPanel(true)}><Icon n="layers" size={16} /> {po ? 'Peta offline aktif' : 'Unggah peta offline'}</button>
          <button className="btn ghost" onClick={() => go('offline')}><Icon n="wifioff" size={16} /> Unduh area peta</button>
        </div>
      </div>
      <div className="split">
        <div>
          <div className="mapstage">
          <div className="rmap">
            <MapView project={project} selected={selId} onSelect={selectPoint} mode={mode} running={running}
              onAddPoint={addPoint} onAddCross={addCross} onDelete={del} onMove={ro ? undefined : movePoint} fly={fly} pin={pin} gpsPos={gps} mapRef={mapRef}
              offline={offline} kalibrasi={kal} onKalibrasi={onKalibrasi} calPts={calPts} jalur={jalur} />
            <div className="map-top">
              <form className="msearch" onSubmit={search}><Icon n="search" /><input placeholder="Cari lokasi atau koordinat…" aria-label="Cari lokasi" value={q} onChange={(e) => setQ(e.target.value)} /></form>
              <div className="mtools">
                {modes.map(([k, ic, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}><Icon n={ic} size={15} />{l}</button>)}
                {mode === 'silang' && <select value={crossType} onChange={(e) => setCrossType(e.target.value)}><option>Jalan</option><option>SUTT</option><option>Sungai</option></select>}
              </div>
              <div className="mtools jalurbar" role="group" aria-label="Jalur tagging">
                <button className={jalur === 'baru' ? 'on' : ''} onClick={() => setJalur('baru')} title="Jalur pemasangan konstruksi baru"><i className="dot" style={{ background: '#E31E24' }} />Pasang (merah)</button>
                <button className={jalur === 'bongkar' ? 'on bongkar' : ''} onClick={() => setJalur('bongkar')} title="Jalur pembongkaran konstruksi lama"><i className="dot" style={{ background: '#9B30D9' }} />Bongkar (ungu)</button>
              </div>
            </div>
            {kal && <div className="chip live">● Kalibrasi: ketuk {calPts.length === 0 ? 'titik pertama' : 'titik kedua'} di peta</div>}
            {running && !kal && <div className="chip live">● {mode === 'titik' ? `Ketuk peta untuk menambah titik ${jalur === 'bongkar' ? 'bongkar (ungu)' : 'pasang (merah)'}` : mode === 'silang' ? `Ketuk peta untuk menandai ${crossType}` : 'Ketuk objek untuk menghapus'}</div>}
            <div className="map-bar">
              <i className={`rec ${running ? 'live' : ''}`} />
              <button className="btn sm" disabled={running} onClick={() => { setRunning(true); markGuide(project.id, 'peta:mulai') }}>Mulai</button>
              <button className="btn sm ghost" disabled={!running} onClick={() => { setRunning(false); markGuide(project.id, 'peta:selesai'); toast('Tagging selesai. Lanjut ke langkah Gambar.') }}>Selesai</button>
            </div>
            <div className="map-ctrl">
              <button className="fab" title="Tambah titik dari GPS" aria-label="Tambah titik dari GPS" onClick={useGps}><Icon n="nav" size={22} /></button>
              <button className="fab" title={`Hapus titik terakhir jalur ${jalur === 'bongkar' ? 'bongkar' : 'pasang'}`} aria-label="Hapus titik terakhir" onClick={hapusTerakhir}><Icon n="undo" size={22} /></button>
            </div>
            {msg && <div className="toast">{msg}</div>}
          </div>
          {panel && <PetaOfflinePanel po={project.petaOffline} hilang={hilang} readOnly={ro} busy={busyPeta} adaTitik={project.points.length > 0} onClose={() => setPanel(false)}
            onUpload={unggahPeta} onAktif={(v) => ubahPetaOff({ aktif: v })} onLebar={(w) => ubahPetaOff({ widthM: w })} onPusat={(c) => ubahPetaOff({ center: c })} onKalibrasi={mulaiKalibrasi} onHapus={hapusPeta} />}
          {adaTerpilih && (
            <div id="atribut" className="atr-float">
              <button type="button" className="atr-x" aria-label="Tutup panel atribut" title="Tutup" onClick={() => setSelId(null)}><Icon n="x" size={16} /></button>
              <AtributPanel project={{ ...project, points: daftarSel }} bongkar={terpilihB} index={idx} onIndex={(i) => setSelId(daftarSel[i].id)} onChange={change}
                onDelete={(id) => { del(id); toast('Titik dihapus') }} onSaved={() => toast('Titik tersimpan otomatis')} />
            </div>
          )}
          </div>
          <div className="stat-row">
            <div className="stat"><b>{project.points.length}</b><span>Titik tiang</span></div>
            <div className="stat"><b>{total.toLocaleString('id-ID')} m</b><span>Total jalur pasang</span></div>
            <div className="stat"><b style={{ color: '#9B30D9' }}>{ptsB.length}</b><span>Titik bongkar</span></div>
            <div className="stat"><b style={{ color: '#9B30D9' }}>{totalB.toLocaleString('id-ID')} m</b><span>Total jalur bongkar</span></div>
            <div className="stat"><b>{tajam}</b><span>Belokan tajam (sudut dalam &lt; {BATAS_SUDUT_DALAM}°)</span></div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function Peta({ go }) {
  const { active } = useApp()
  return active ? <Inner key={active.id} go={go} /> : <Empty go={go} judul="Peta & Tagging Titik" />
}