import { useRef, useState } from 'react'
import { useApp, linkOf } from '../store'
import { exportExcel } from '../lib/exportExcel'
import Empty from './Empty'

// F9 Foto lokasi dan ekspor Excel (sheet GAMBAR dan RAB)
export default function Ekspor({ go }) {
  const { active: p, addFoto } = useApp()
  const file = useRef(null), [copied, setCopied] = useState(false)
  if (!p) return <Empty go={go} judul="Foto & Ekspor" />
  const salin = async () => { try { await navigator.clipboard.writeText(linkOf(p)); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { window.prompt('Salin link project:', linkOf(p)) } }
  const foto = p.foto || []
  return (
    <>
      <div className="pg-h"><h1>Foto &amp; Ekspor</h1></div>
      <div className="two-col">
        <div className="card">
          <div className="card-h"><h2>Foto lokasi</h2><span className="sub">{foto.length} foto</span></div>
          <div className="card-b">
            <div className="photos">
              {foto.map((f) => <div key={f.id} className={`ph ${f.pending ? 'pending' : ''}`}><img src={f.src} alt="Foto lokasi" /></div>)}
              <button className="ph add" onClick={() => file.current.click()}>+ Foto</button>
            </div>
            <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; f && addFoto(p.id, f); e.target.value = '' }} />
            <p className="hint" style={{ marginTop: 10 }}>Foto disimpan di perangkat dan dikirim ke server saat online.</p>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h2>Ekspor Excel</h2></div>
          <div className="card-b stack">
            <div className="exp"><div className="ic">XLS</div><div><b>Sheet GAMBAR</b><span>Gambar skematik, legenda, kotak judul</span></div><span className="chip2 ok">Siap</span></div>
            <div className="exp"><div className="ic">XLS</div><div><b>Sheet RAB</b><span>Kelompok pekerjaan, harga, jenis RAB, asal material</span></div><span className="chip2 ok">Siap</span></div>
            <button className="btn" style={{ width: '100%', height: 46 }} onClick={() => exportExcel(p)}>Unduh Excel (.xlsx)</button>
            <button className="btn ghost" onClick={salin}>{copied ? 'Link tersalin ✓' : 'Salin link project'}</button>
          </div>
        </div>
      </div>
    </>
  )
}