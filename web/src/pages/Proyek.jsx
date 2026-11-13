import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { Icon } from '../components/ui'
import { api } from '../lib/api'

// F7 Simpan dan kelola project: Cari, Buka, Salin; buka lewat link atau kode project
export default function Proyek({ go }) {
  const { state, copy, remove, setActive, update, openRemote, online } = useApp()
  const [q, setQ] = useState(''), [remote, setRemote] = useState([]), [kode, setKode] = useState(''), [err, setErr] = useState('')
  const list = state.projects.filter((p) => `${p.nomor} ${p.nama} ${p.lokasi} ${p.kode}`.toLowerCase().includes(q.toLowerCase()))

  // Cari juga di server (semua project UP3) dan tampilkan yang belum ada di perangkat ini
  useEffect(() => {
    if (!online || q.trim().length < 2) return setRemote([])
    const t = setTimeout(() => api.get(`/api/proyek?q=${encodeURIComponent(q.trim())}`).then((r) => setRemote(r.filter((x) => !state.projects.some((p) => p.kode === x.kode)))).catch(() => setRemote([])), 350)
    return () => clearTimeout(t)
  }, [q, online, state.projects])

  const bukaKode = async (e) => {
    e.preventDefault(); setErr('')
    const m = /([A-Za-z0-9_-]{8,32})\/?$/.exec(kode.trim().replace(/[#?].*$/, '')) || /#\/p\/([A-Za-z0-9_-]{8,32})/.exec(kode)
    if (!m) return setErr('Kode atau link tidak dikenali')
    try { await openRemote(m[1]); setKode(''); go('peta') } catch { setErr(online ? 'Project tidak ditemukan' : 'Butuh internet untuk membuka project dari server') }
  }
  const tgl = (p) => (p.updated_at ? new Date(p.updated_at) : p.tanggal ? new Date(p.tanggal) : null)?.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  const Item = ({ p, remoteRow }) => {
    const final = p.status === 'Selesai'
    return (
      <div className={`pitem ${!remoteRow && p.id === state.activeId ? 'act' : ''}`}>
        <div>
          <h3>{p.jenis === 'Tambah Daya' ? 'TD' : 'PB'} {p.nama}{p.daya ? ` · ${Number(p.daya).toLocaleString('id-ID')} VA` : ''}</h3>
          <div className="pmeta"><span>No. {p.nomor}</span><span>{p.lokasi}</span>{p.version ? <span>v{p.version}</span> : null}{tgl(p) && <span>{tgl(p)}</span>}</div>
          <div className="prow" style={{ marginTop: 6 }}>
            <span className={`chip2 ${final ? 'final' : 'draft'}`}>{final ? 'Final' : 'Draft'}</span>
            <span className="code">{p.kode}</span>
            <span className="pmeta">{remoteRow ? `${p.titik} titik · di server` : `${p.points.length} titik · ${!p.version ? 'belum terkirim' : p.dirty ? 'menunggu sinkron' : 'tersinkron'}`}</span>
          </div>
        </div>
        <div className="pitem-act">
          <button className="btn sm" onClick={() => (remoteRow ? openRemote(p.kode).then(() => go('peta')) : (setActive(p.id), go('peta')))}>Buka</button>
          {!remoteRow && <>
            <button className="btn sm ghost" onClick={() => copy(p.id)}>Salin</button>
            {!final && <button className="btn sm ghost" title="Tandai selesai (final)" onClick={() => update(p.id, { status: 'Selesai' })}>Finalisasi</button>}
            <button className="btn sm danger" title="Hapus project" onClick={() => window.confirm(`Hapus project ${p.nomor}?`) && remove(p.id)}><Icon n="trash" size={14} /></button>
          </>}
        </div>
      </div>
    )
  }
  return (
    <>
      <div className="pg-h">
        <h1>Project Tersimpan</h1>
        <div className="actions"><button className="btn" onClick={() => go('data', 'baru')}>+ Project baru</button></div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <form className="findbar" onSubmit={bukaKode}>
          <input type="search" className="rin" style={{ flex: '1 1 260px', background: '#fff' }} placeholder="Cari nama pelanggan, nomor pekerjaan, atau kode…" value={q} onChange={(e) => { setQ(e.target.value); setKode(e.target.value) }} aria-label="Cari project atau buka dengan kode" />
          <button className="btn ghost" type="submit">Buka dengan kode</button>
        </form>
        {err && <p className="err" style={{ padding: '0 14px 12px' }}>{err}</p>}
      </div>
      <div className="plist">
        {list.map((p) => <Item key={p.id} p={p} />)}
      </div>
      {!list.length && !remote.length && <div className="card"><div className="empty-card">Belum ada project{q ? ' yang cocok' : ''}.</div></div>}
      {remote.length > 0 && <>
        <h2 style={{ fontSize: 14, color: 'var(--b900)', margin: '18px 0 8px' }}>Ditemukan di server</h2>
        <div className="plist">{remote.map((p) => <Item key={p.kode} p={p} remoteRow />)}</div>
      </>}
    </>
  )
}