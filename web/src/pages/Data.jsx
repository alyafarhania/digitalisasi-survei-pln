import { useState } from 'react'
import { useApp } from '../store'
import { MASTER, GRUP_JALUR } from '../lib/konstruksi'
import { Icon } from '../components/ui'

const ULP = ['ULP Klaten', 'ULP Pedan', 'ULP Delanggu', 'ULP Prambanan', 'ULP Cawas', 'ULP Jatinom', 'ULP Boyolali']
const short = (g) => g.replace('KONSTRUKSI ', '').replace('PADA TIANG ', '')

// F1 Data pelanggan. Tanpa project aktif (atau lewat "Project baru") = isian project baru; selain itu mengubah project aktif langsung.
export default function Data({ go, opt }) {
  const { active, add, addDemo, update } = useApp()
  const baru = opt === 'baru' || !active
  const [f, setF] = useState({ nama: '', jenis: 'Pasang Baru', nomor: '', lokasi: '', tarif: MASTER.tarif[0] || 'R1', daya: '', ulp: 'ULP Klaten', dayaLama: '', feeder: '', gi: '', subsistem: '' })
  const p = baru ? null : active
  const val = (k) => (p ? (k in (p.meta || {}) ? p.meta[k] : p[k]) ?? '' : f[k])
  const META = ['ulp', 'dayaLama', 'feeder', 'gi', 'subsistem']
  const set = (k, v) => {
    if (!p) return setF((x) => ({ ...x, [k]: v }))
    update(p.id, (x) => (META.includes(k) ? { ...x, meta: { ...x.meta, [k]: v } } : { ...x, [k]: k === 'daya' ? Number(v) || 0 : v }))
  }
  const ok = f.nama.trim() && f.lokasi.trim()
  const simpan = () => {
    const { ulp, dayaLama, feeder, gi, subsistem, ...d } = f
    add({ ...d, nomor: d.nomor || undefined, daya: Number(d.daya) || 0,
      meta: { noGambar: '', skala: '1 : 500', perihal: d.jenis, digambar: '', diperiksa: '', diketahui: '', disetujui: '', ulp, dayaLama, feeder, gi, subsistem } })
    go('peta')
  }
  const first = p?.points?.[0]
  const T = (k, label, o = {}) => (
    <div className={`fld ${o.full ? 'full' : ''}`}><label>{label}{o.req && <> <i>*</i></>}</label>
      <input type={o.type || 'text'} className="rin" inputMode={o.num ? 'numeric' : undefined} value={val(k)} readOnly={o.ro} placeholder={o.ph} onChange={(e) => set(k, e.target.value)} />
      {o.hint && <span className="hint">{o.hint}</span>}</div>
  )
  return (
    <>
      <div className="pg-h">
        <h1>{baru ? 'Project Baru' : 'Data Pelanggan'}</h1>
        <div className="actions">
          {baru ? <button className="btn" disabled={!ok} onClick={simpan}>Simpan &amp; Lanjut ke Peta <Icon n="chevR" size={16} /></button>
            : <><button className="btn" onClick={() => go('data', 'baru')}>+ Pelanggan baru</button><button className="btn ghost" onClick={() => go('peta')}>Lanjut ke Peta <Icon n="chevR" size={16} /></button></>}
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h2>Informasi pekerjaan</h2><span className="sub">Kolom bertanda <i style={{ color: '#D32F2F', fontStyle: 'normal' }}>*</i> wajib diisi</span></div>
        <div className="card-b grid g2 g3">
          <div className="fld full"><label>Nama calon pelanggan <i>*</i></label><input type="text" className="rin" value={val('nama')} placeholder="mis. PABRIK ROKOK HS PEDAN" onChange={(e) => set('nama', e.target.value)} /></div>
          <div className="fld full"><label>Jenis pekerjaan <i>*</i></label>
            <div className="seg">{['Pasang Baru', 'Tambah Daya'].map((j) => <button type="button" key={j} className={val('jenis') === j ? 'on' : ''} onClick={() => set('jenis', j)}>{j}</button>)}</div></div>
          {T('nomor', 'Nomor pekerjaan', { req: true, ph: 'mis. PB/2026/10/0053', hint: 'Mengikuti penomoran kantor, diisi manual.' })}
          <div className="fld"><label>Lokasi / ULP <i>*</i></label>
            <select value={val('ulp') || 'ULP Klaten'} onChange={(e) => set('ulp', e.target.value)}>{ULP.map((u) => <option key={u}>{u}</option>)}</select></div>
          <div className="fld"><label>Koordinat lokasi</label>
            <input type="text" className="rin" readOnly value={first ? `${first.lat.toFixed(6)}, ${first.lng.toFixed(6)}` : ''} placeholder="Belum ada titik" /><span className="hint">Terisi otomatis dari peta.</span></div>
          <div className="fld full"><label>Alamat / lokasi pekerjaan <i>*</i></label><input type="text" className="rin" value={val('lokasi')} placeholder="Alamat, desa, kecamatan" onChange={(e) => set('lokasi', e.target.value)} /></div>
          <div className="fld"><label>Golongan tarif <i>*</i></label>
            <select value={val('tarif')} onChange={(e) => set('tarif', e.target.value)}>{MASTER.tarif.map((t) => <option key={t}>{t}</option>)}</select></div>
          {T('daya', 'Daya baru (VA)', { req: true, num: true, ph: '1300' })}
          {T('dayaLama', 'Daya lama (VA)', { num: true, ph: '—', hint: 'Khusus tambah daya.' })}
          <div className="sec-t">Penyulang jaringan</div>
          {T('feeder', 'Feeder', { ph: 'mis. PDN02' })}
          {T('gi', 'Gardu Induk', { ph: 'mis. Pedan' })}
          {T('subsistem', 'Sub sistem', { ph: 'mis. SS PEDAN' })}
          {p && <div className="fld full"><label>Jenis jaringan (standar konstruksi)</label>
            <select value={p.jalur} onChange={(e) => update(p.id, { jalur: e.target.value })}>{GRUP_JALUR.map((g) => <option key={g} value={g}>{short(g)}</option>)}</select>
            <span className="hint">Menentukan kode konstruksi dan upah yang dipakai di gambar dan RAB.</span></div>}
        </div>
      </div>
      {baru && !active && <div className="actions" style={{ margin: '14px 0 0' }}><button className="btn ghost" onClick={() => { addDemo(); go('peta') }}>Coba dengan project contoh</button></div>}
    </>
  )
}