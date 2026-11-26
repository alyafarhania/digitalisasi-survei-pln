import { Combo } from './ui'
import { MASTER, kodeList, maxSudut } from '../lib/konstruksi'
import { dist } from '../lib/geo'

const KONDISI = ['Baru', 'Eksisting', 'Bongkar']
const F = ({ label, hint, full, children }) => <div className={`fld ${full ? 'full' : ''}`}><label>{label}</label>{children}{hint && <span className="hint">{hint}</span>}</div>

// F3 Atribut per titik: tab titik di atas, isian dua kolom (mengikuti referensi)
export default function AtributPanel({ project, index, onIndex, onChange, onDelete, onSaved }) {
  const p = project.points[index]
  const head = (
    <div className="card-h"><h2>Atribut titik</h2><span className="sub">{p ? p.nomor : ''}</span></div>
  )
  if (!p) return <div className="card">{head}<div className="card-b"><p className="muted" style={{ margin: 0 }}>Belum ada titik. Tekan <b>Mulai</b>, lalu ketuk peta untuk menandai tiang.</p></div></div>
  const set = (k) => (v) => onChange(p.id, { [k]: v })
  const prev = project.points[index - 1]
  const autoLen = prev ? Math.round(dist(prev, p)) : 0
  const kons = kodeList(project.jalur)
  const kode = p.kodeManual || p.kode
  const tajam = p.sudut > maxSudut(project.jalur)
  return (
    <div className="card">
      {head}
      <div className="card-b">
        <div className="pt-list">
          {project.points.map((x, i) => <button key={x.id} className={i === index ? 'on' : ''} onClick={() => onIndex(i)}>Titik {i + 1}</button>)}
        </div>
        <div className="grid g2">
          <F label="Nomor tiang" hint="Diketik surveyor"><input className="rin" value={p.nomor || ''} onChange={(e) => set('nomor')(e.target.value)} /></F>
          <F label="Jenis tiang"><Combo value={p.jenisTiang} onChange={set('jenisTiang')} options={MASTER.tiang.map((t) => t.nama)} /></F>
          <F label="Jenis peralatan"><Combo value={p.peralatan} onChange={set('peralatan')} options={MASTER.peralatan.map((t) => t.nama)} placeholder="Ketik untuk mencari…" /></F>
          <F label="Jenis konduktor"><Combo value={p.konduktor} onChange={set('konduktor')} options={MASTER.konduktor.map((t) => ({ v: t.nama, l: `${t.nama} · ${t.kelompok_garis} ${t.fasa} fasa` }))} /></F>
          <F label="Panjang konduktor (m)" hint="Dihitung dari jarak dua titik, bisa diedit."><input className="rin" inputMode="numeric" value={p.panjang ?? ''} onChange={(e) => set('panjang')(e.target.value)} placeholder={String(autoLen)} /></F>
          <F label="Konstruksi baru" hint={tajam ? `Sudut ${p.sudut}° terlalu tajam` : p.kodeManual ? 'Diubah manual' : `Otomatis dari sudut ${p.sudut ?? 0}°`}><Combo value={kode} onChange={(v) => onChange(p.id, { kodeManual: v || undefined })} options={kons} placeholder="Pilih kode" /></F>
          <F label="Konstruksi lama" hint="Tidak ada biaya"><Combo value={p.konsLama} onChange={set('konsLama')} options={kons} placeholder="Ketik untuk mencari…" /></F>
          <F label="Konstruksi bongkar" hint="Biaya hanya upah bongkar"><Combo value={p.konsBongkar} onChange={set('konsBongkar')} options={kons} placeholder="Ketik untuk mencari…" /></F>
          <F label="Status tiang" full><div className="seg">{KONDISI.map((k) => <button key={k} className={p.kondisi === k ? 'on' : ''} onClick={() => set('kondisi')(k)}>{k}</button>)}</div></F>
        </div>
        <div className="atr-actions">
          <button className="btn" onClick={onSaved}>Simpan titik</button>
          <button className="btn danger" onClick={() => onDelete(p.id)}>Hapus</button>
        </div>
      </div>
    </div>
  )
}
