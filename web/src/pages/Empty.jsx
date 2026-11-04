import { Icon } from '../components/ui'
// Tampilan bila belum ada project aktif
export default function Empty({ go, judul }) {
  return (
    <>
      <div className="pg-h"><h1>{judul}</h1></div>
      <div className="card"><div className="empty-card">
        <Icon n="folder" size={34} />
        <p style={{ margin: 0 }}>Belum ada project aktif. Isi data pelanggan terlebih dahulu, atau buka project yang sudah tersimpan.</p>
        <div className="actions" style={{ margin: 0 }}>
          <button className="btn primary" onClick={() => go('data', 'baru')}>Buat project baru</button>
          <button className="btn ghost" onClick={() => go('project')}>Buka project</button>
        </div>
      </div></div>
    </>
  )
}
