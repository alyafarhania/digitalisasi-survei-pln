import { useEffect, useState, useCallback } from 'react'
import { Icon, Button } from './ui'
import { fotoGet } from '../lib/fotoStore'
import { MOCK } from '../lib/api'
import { fmtWaktu } from '../lib/audit'

// Alamat gambar foto: dari penyimpanan perangkat (IndexedDB); bila tidak ada dan mode live, dari server.
export function useFotoUrl(id) {
  const [url, setUrl] = useState(null) // null = memuat, '' = tidak ada
  useEffect(() => {
    let hidup = true, obj = null
    setUrl(null)
    fotoGet(id).then((blob) => {
      if (!hidup) return
      if (blob) { obj = URL.createObjectURL(blob); setUrl(obj) } else setUrl(MOCK ? '' : `/api/foto/${id}`)
    })
    return () => { hidup = false; if (obj) URL.revokeObjectURL(obj) }
  }, [id])
  return url
}

export function FotoImg({ f, alt, ...p }) {
  const url = useFotoUrl(f.id)
  if (url === null) return <span className="ph-skel" aria-label="Memuat foto" />
  if (url === '') return <span className="ph-miss" title="Foto tidak tersedia di perangkat ini"><Icon n="camera" size={22} /><small>Belum diunduh</small></span>
  return <img src={url} alt={alt} loading="lazy" decoding="async" {...p} />
}

// Pratinjau besar (pop over): ←/→ pindah foto, Esc tutup. Hapus hanya bila boleh mengubah project.
export function Lightbox({ fotos, index, onIndex, onClose, onDelete, canDelete }) {
  const f = fotos[index], url = useFotoUrl(f?.id), [hapus, setHapus] = useState(false)
  const n = fotos.length
  const ke = useCallback((d) => onIndex((index + d + n) % n), [index, n, onIndex])
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') (hapus ? setHapus(false) : onClose()); if (n > 1 && !hapus) { if (e.key === 'ArrowLeft') ke(-1); if (e.key === 'ArrowRight') ke(1) } }
    window.addEventListener('keydown', h)
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = prev }
  }, [ke, n, hapus, onClose])
  if (!f) return null
  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label={`Foto lokasi ${index + 1} dari ${n}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lb-top">
        <span className="lb-count">{index + 1} / {n}</span>
        <div className="lb-act">
          {url && <a className="lb-btn" href={url} download={f.name || `foto-${index + 1}.jpg`} aria-label="Unduh foto"><Icon n="download" size={18} /></a>}
          {canDelete && <button type="button" className="lb-btn danger" onClick={() => setHapus(true)} aria-label="Hapus foto"><Icon n="trash" size={18} /></button>}
          <button type="button" className="lb-btn" onClick={onClose} aria-label="Tutup"><Icon n="x" size={20} /></button>
        </div>
      </div>
      <div className="lb-stage" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        {n > 1 && <button type="button" className="lb-nav l" onClick={() => ke(-1)} aria-label="Foto sebelumnya"><Icon n="chevL" size={26} /></button>}
        {url ? <img className="lb-img" src={url} alt={`Foto lokasi ${index + 1}`} /> : <div className="lb-empty">{url === null ? <span className="spin" /> : 'Foto belum tersedia di perangkat ini'}</div>}
        {n > 1 && <button type="button" className="lb-nav r" onClick={() => ke(1)} aria-label="Foto berikutnya"><Icon n="chevR" size={26} /></button>}
      </div>
      <div className="lb-cap">
        <b>{f.by?.name ? `Diunggah oleh ${f.by.name}` : 'Foto lokasi'}</b>
        <span>{[f.at && fmtWaktu(f.at), f.name, f.pending && 'menunggu unggah ke server'].filter(Boolean).join(' · ')}</span>
      </div>
      {hapus && (
        <div className="lb-confirm" role="alertdialog" aria-label="Konfirmasi hapus foto">
          <p><b>Hapus foto ini?</b><br />Foto tidak dapat dikembalikan.</p>
          <div><Button variant="danger" size="sm" onClick={() => { onDelete(f.id); setHapus(false); n === 1 ? onClose() : onIndex(Math.min(index, n - 2)) }}>Ya, hapus</Button><Button variant="secondary" size="sm" onClick={() => setHapus(false)}>Batal</Button></div>
        </div>
      )}
    </div>
  )
}
