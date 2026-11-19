import { useRef, useState } from 'react'
import { useApp, linkOf } from '../store'
import { useAuth } from '../lib/authContext'
import { exportExcel } from '../lib/exportExcel'
import { hitungRab, rabKosong } from '../lib/rab'
import { Alert, Button, Card, Icon, PageHeader } from '../components/ui'
import { FotoImg, Lightbox } from '../components/Foto'
import Empty from './Empty'

// F9 Foto lokasi dan ekspor Excel (sheet GAMBAR dan RAB)
export default function Ekspor({ go }) {
  const { active: p, addFoto, removeFoto, markGuide } = useApp()
  const { can, canEdit } = useAuth()
  const file = useRef(null), [copied, setCopied] = useState(false), [busy, setBusy] = useState(false), [lb, setLb] = useState(null)
  if (!p) return <Empty go={go} judul="Foto & Ekspor" />
  const bisaUbah = canEdit(p), bisaEkspor = can('project:export')
  const salin = async () => { try { await navigator.clipboard.writeText(linkOf(p)); markGuide(p.id, 'ekspor:link'); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { window.prompt('Salin link project:', linkOf(p)) } }
  const foto = p.foto || []
  const kosong = rabKosong(hitungRab(p)), terkunci = kosong.length > 0
  const unduh = async () => { setBusy(true); try { await exportExcel(p); markGuide(p.id, 'ekspor:unduh') } catch { window.alert('Gagal membuat Excel. Coba lagi.') } finally { setBusy(false) } }
  return (
    <>
      <PageHeader title="Foto & Ekspor" />
      <div className="two-col">
        <Card title="Foto lokasi" sub={`${foto.length} foto`}>
          <div className="photos" data-testid="photos">
            {foto.map((f, i) => (
              <button type="button" key={f.id} className={`ph ${f.pending ? 'pending' : ''}`} onClick={() => setLb(i)} aria-label={`Lihat foto ${i + 1}`}>
                <FotoImg f={f} alt={`Foto lokasi ${i + 1}`} />
                {f.pending && <span className="ph-badge">Menunggu</span>}
                <span className="ph-zoom"><Icon n="search" size={16} /></span>
              </button>
            ))}
            {bisaUbah && <button type="button" className="ph add" onClick={() => file.current.click()}><Icon n="camera" size={22} />Tambah foto</button>}
          </div>
          {!foto.length && !bisaUbah && <p className="hint">Belum ada foto lokasi.</p>}
          <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; f && addFoto(p.id, f); e.target.value = '' }} />
          <p className="hint" style={{ marginTop: 10 }}>Ketuk foto untuk memperbesar. Foto dikecilkan otomatis, disimpan di perangkat, dan dikirim ke server saat online.</p>
        </Card>
        <Card title="Ekspor Excel">
          <div className="stack">
            <div className="exp"><div className="ic">XLS</div><div><b>Sheet GAMBAR</b><span>Gambar skematik, legenda, kotak judul</span></div><span className="chip2 ok">Siap</span></div>
            <div className="exp"><div className="ic">XLS</div><div><b>Sheet RAB</b><span>Kelompok pekerjaan, harga, jenis RAB, asal material</span></div><span className="chip2 ok">Siap</span></div>
            {terkunci && <Alert tone="bad" title="Ekspor terkunci.">{kosong.length} item RAB belum punya harga. <a href="#" onClick={(e) => { e.preventDefault(); go('rab') }}>Buka Material &amp; RAB</a> untuk mengisinya.</Alert>}
            {!bisaEkspor && <Alert tone="warn">Peran Anda tidak memiliki izin ekspor.</Alert>}
            <Button style={{ width: '100%', height: 46 }} disabled={terkunci || busy || !bisaEkspor} onClick={unduh}>{busy ? 'Membuat Excel…' : 'Unduh Excel (.xlsx)'}</Button>
            <Button variant="secondary" onClick={salin}>{copied ? 'Link tersalin ✓' : 'Salin link project'}</Button>
          </div>
        </Card>
      </div>
      {lb !== null && foto[lb] && <Lightbox fotos={foto} index={lb} onIndex={setLb} onClose={() => setLb(null)} canDelete={bisaUbah} onDelete={(id) => removeFoto(p.id, id)} />}
    </>
  )
}
