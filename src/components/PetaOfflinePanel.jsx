import { useRef, useState } from 'react'
import { Button, Icon, Modal } from './ui'

// Unggah peta offline (gambar dari galeri/penyimpanan, mis. peta Satplant) dan atur skala/posisinya.
// Gambar ini menggantikan peta online saat menandai titik dan menjadi latar pada hasil gambar konstruksi (PNG & Excel).
export default function PetaOfflinePanel({ po, hilang, readOnly, busy, adaTitik, onClose, onUpload, onAktif, onLebar, onPusat, onKalibrasi, onHapus }) {
  const file = useRef(null)
  const [lebar, setLebar] = useState(po ? String(Math.round(po.widthM)) : '')
  const [pusat, setPusat] = useState(po ? `${po.center.lat.toFixed(6)}, ${po.center.lng.toFixed(6)}` : '')
  const [err, setErr] = useState('')
  const terapkanLebar = () => { const v = parseFloat(String(lebar).replace(',', '.')); if (!(v >= 20 && v <= 20000)) return setErr('Lebar area harus 20–20.000 m.'); setErr(''); onLebar(v) }
  const terapkanPusat = () => {
    const m = pusat.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/)
    if (!m || Math.abs(+m[1]) > 90 || Math.abs(+m[2]) > 180) return setErr('Isi koordinat seperti -7.7059, 110.6016')
    setErr(''); onPusat({ lat: +m[1], lng: +m[2] })
  }
  return (
    <Modal title="Peta offline (unggah dari perangkat)" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Tutup</Button>}>
      <div className="stack po-panel">
        <p className="hint" style={{ margin: 0 }}>Pilih gambar peta dari galeri atau penyimpanan HP/laptop (mis. tangkapan layar peta Satplant, format JPG/PNG/WebP). Gambar dipakai <b>menggantikan peta online</b> saat menandai titik, dan menjadi <b>latar pada gambar konstruksi</b> di PNG dan Excel.</p>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; f && onUpload(f); e.target.value = '' }} />
        {!readOnly && <Button icon="plus" disabled={busy} onClick={() => file.current.click()}>{busy ? 'Memproses gambar…' : po ? 'Ganti gambar peta' : 'Pilih gambar peta'}</Button>}
        {po && (
          <>
            <div className="po-info"><b>{po.name}</b><span>{po.w} × {po.h} px</span></div>
            {hilang && <p className="hint bad" style={{ margin: 0 }}>Gambar peta tidak ada di perangkat ini (project dibuka dari perangkat lain). Unggah ulang peta yang sama.</p>}
            <div className="seg" role="group" aria-label="Peta yang dipakai">
              <button type="button" className={po.aktif ? 'on' : ''} disabled={readOnly} onClick={() => onAktif(true)}>Peta offline</button>
              <button type="button" className={!po.aktif ? 'on' : ''} disabled={readOnly} onClick={() => onAktif(false)}>Peta online</button>
            </div>
            <div className="fld"><label>Lebar area pada gambar (meter)</label>
              <div className="po-row"><input className="rin" inputMode="decimal" value={lebar} disabled={readOnly} onChange={(e) => setLebar(e.target.value)} />
                <Button size="sm" disabled={readOnly} onClick={terapkanLebar}>Terapkan</Button></div>
              <span className="hint">Skala menentukan jarak antar titik dan panjang penghantar. Atur sebelum tagging{adaTitik ? '; titik yang sudah ada ikut menyesuaikan' : ''}.</span></div>
            <Button variant="secondary" disabled={readOnly || !po.aktif} onClick={onKalibrasi}><Icon n="pin" size={15} /> Kalibrasi skala dengan 2 titik</Button>
            <div className="fld"><label>Koordinat pusat gambar (opsional)</label>
              <div className="po-row"><input className="rin" value={pusat} disabled={readOnly} onChange={(e) => setPusat(e.target.value)} />
                <Button size="sm" disabled={readOnly} onClick={terapkanPusat}>Terapkan</Button></div>
              <span className="hint">Dipakai untuk tulisan KOORDINAT pada gambar. Gambar dianggap menghadap utara.</span></div>
            {err && <p className="hint bad" style={{ margin: 0 }}>{err}</p>}
            {!readOnly && <Button variant="danger" onClick={onHapus}>Hapus peta offline</Button>}
          </>
        )}
      </div>
    </Modal>
  )
}
