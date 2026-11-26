import { useState } from 'react'
import { Combo, Icon } from './ui'
import { MASTER, kodeList, grupJtr, grupList, grupLabel, kodeOptions } from '../lib/konstruksi'
import { sudutDalam, isTajamPoint, BATAS_SUDUT_DALAM } from '../lib/tajam'
import { dist } from '../lib/geo'

const KONDISI = ['Baru', 'Eksisting', 'Bongkar']
const F = ({ label, hint, full, children }) => <div className={`fld ${full ? 'full' : ''}`}><label>{label}</label>{children}{hint && <span className="hint">{hint}</span>}</div>


// Satu titik boleh punya beberapa konstruksi baru. Konstruksi yang ditambahkan di sini MASUK ke kategori Konstruksi Baru
// dan tidak menimpa konstruksi utama, konstruksi lama, maupun konstruksi bongkar yang sudah ada di titik itu.
function KonsBaruEditor({ p, onChange }) {
  const daftar = p.konsBaru || []
  const [buka, setBuka] = useState(false), [grup, setGrup] = useState(grupJtr(p.jenisTiang)), [kode, setKode] = useState('')
  const eks = p.kondisi === 'Eksisting'
  const tambah = () => {
    if (!kode) return
    onChange(p.id, { konsBaru: [...daftar, { id: crypto.randomUUID(), grup, kode }] })
    setKode(''); setBuka(false)
  }
  const hapus = (id) => onChange(p.id, { konsBaru: daftar.filter((x) => x.id !== id) })
  const mulai = (g) => { setGrup(g); setKode(''); setBuka(true) }
  return (
    <div className="fld full kb">
      <label>Konstruksi baru tambahan <span className="kb-n">{daftar.length ? `${daftar.length} ditambahkan` : ''}</span></label>
      {daftar.length > 0 && (
        <ul className="kb-list">
          {daftar.map((x) => (
            <li key={x.id}><b>{x.kode}</b><span>{grupLabel(x.grup)}</span>
              <button type="button" className="kb-x" aria-label={`Hapus konstruksi ${x.kode}`} title="Hapus" onClick={() => hapus(x.id)}><Icon n="x" size={13} /></button></li>
          ))}
        </ul>
      )}
      {!buka ? (
        <div className="kb-actions">
          <button type="button" className="btn sm" onClick={() => mulai(grupJtr(p.jenisTiang))}><Icon n="plus" size={14} /> Tambah konstruksi JTR</button>
          <button type="button" className="btn sm ghost" onClick={() => mulai(grup)}>Konstruksi lain…</button>
        </div>
      ) : (
        <div className="kb-form">
          <select className="rin" aria-label="Kelompok konstruksi" value={grup} onChange={(e) => { setGrup(e.target.value); setKode('') }}>
            {grupList().map((g) => <option key={g} value={g}>{grupLabel(g)}</option>)}
          </select>
          <Combo value={kode} onChange={setKode} options={kodeOptions(grup)} placeholder="Pilih kode konstruksi" />
          <div className="kb-actions"><button type="button" className="btn sm" disabled={!kode} onClick={tambah}>Tambahkan</button><button type="button" className="btn sm ghost" onClick={() => setBuka(false)}>Batal</button></div>
        </div>
      )}
      <span className="hint">{eks ? 'Tiang eksisting: konstruksi lama tetap, yang ditambahkan di sini masuk Konstruksi Baru (merah). ' : ''}Satu titik dapat menyimpan banyak konstruksi sekaligus.</span>
    </div>
  )
}

// F3 Atribut per titik: tab titik di atas, isian dua kolom (mengikuti referensi)
// bongkar = titik pada jalur pembongkaran (ungu): hanya data tiang/penghantar dan konstruksi yang dibongkar
export default function AtributPanel({ project, index, onIndex, onChange, onDelete, onSaved, bongkar }) {
  const p = project.points[index]
  const head = (
    <div className="card-h"><h2>{bongkar ? 'Atribut titik bongkar' : 'Atribut titik'}</h2><span className="sub">{p ? p.nomor : ''}</span></div>
  )
  if (!p) return <div className="card">{head}<div className="card-b"><p className="muted" style={{ margin: 0 }}>Belum ada titik. Tekan <b>Mulai</b>, lalu ketuk peta untuk menandai tiang.</p></div></div>
  const set = (k) => (v) => onChange(p.id, { [k]: v })
  const prev = project.points[index - 1]
  const autoLen = prev ? Math.round(dist(prev, p)) : 0
  const kons = kodeList(project.jalur)
  const kode = p.kodeManual || p.kode
  const tajam = isTajamPoint(project, p)
  return (
    <div className="card">
      {head}
      <div className="card-b">
        <div className="pt-list">
          {project.points.map((x, i) => <button key={x.id} className={i === index ? 'on' : ''} onClick={() => onIndex(i)}>{bongkar ? 'Bongkar' : 'Titik'} {i + 1}</button>)}
        </div>
        <div className="grid g2">
          <F label="Nomor tiang" hint="Diketik surveyor"><input className="rin" value={p.nomor || ''} onChange={(e) => set('nomor')(e.target.value)} /></F>
          <F label="Jenis tiang"><Combo value={p.jenisTiang} onChange={set('jenisTiang')} options={MASTER.tiang.map((t) => t.nama)} /></F>
          <F label="Jenis peralatan"><Combo value={p.peralatan} onChange={set('peralatan')} options={MASTER.peralatan.map((t) => t.nama)} placeholder="Ketik untuk mencari…" /></F>
          <F label="Jenis konduktor"><Combo value={p.konduktor} onChange={set('konduktor')} options={MASTER.konduktor.map((t) => ({ v: t.nama, l: `${t.nama} · ${t.kelompok_garis} ${t.fasa} fasa` }))} /></F>
          <F label="Panjang konduktor (m)" hint="Dihitung dari jarak dua titik, bisa diedit."><input className="rin" inputMode="numeric" value={p.panjang ?? ''} onChange={(e) => set('panjang')(e.target.value)} placeholder={String(autoLen)} /></F>
          {!bongkar && (<F label="Konstruksi baru (utama)" hint={tajam ? `Sudut dalam ${sudutDalam(p)}° (< ${BATAS_SUDUT_DALAM}°): terlalu tajam` : p.kodeManual ? 'Diubah manual' : `Otomatis dari belokan ${p.sudut ?? 0}°`}><Combo value={kode} onChange={(v) => onChange(p.id, { kodeManual: v || undefined })} options={kons} placeholder="Pilih kode" /></F>)}
          {!bongkar && (<KonsBaruEditor key={p.id} p={p} onChange={onChange} />)}
          {!bongkar && (<F label="Konstruksi lama" hint="Tidak ada biaya"><Combo value={p.konsLama} onChange={set('konsLama')} options={kons} placeholder="Ketik untuk mencari…" /></F>)}
          <F label="Konstruksi bongkar" hint={bongkar ? "Konstruksi lama yang dibongkar di titik ini (upah bongkar)" : "Biaya hanya upah bongkar"}><Combo value={p.konsBongkar} onChange={set('konsBongkar')} options={kons} placeholder="Ketik untuk mencari…" /></F>
          {!bongkar && (<F label="Status tiang" full><div className="seg">{KONDISI.map((k) => <button key={k} className={p.kondisi === k ? 'on' : ''} onClick={() => set('kondisi')(k)}>{k}</button>)}</div></F>)}
        </div>
        <div className="atr-actions">
          <button className="btn" onClick={onSaved}>Simpan titik</button>
          <button className="btn danger" onClick={() => onDelete(p.id)}>Hapus</button>
        </div>
      </div>
    </div>
  )
}
