import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store'
import { Button, Card, Chip, EmptyState, Icon, PageHeader, Alert, Select } from '../components/ui'
import { api } from '../lib/api'
import { STEPS, stepStatus } from '../lib/steps'
import { useAuth } from '../lib/authContext'
import { ACTION, auditSummary, fmtWaktu } from '../lib/audit'
import { ROLES } from '../lib/auth'
import { Modal } from '../components/ui'

// Halaman awal: daftar project. Membuat pelanggan baru selalu lewat tombol "Project baru" (tidak otomatis).
// F7 Simpan dan kelola project: Cari, Buka, Salin; buka lewat link atau kode project.
const PAGE = 10
const SORTS = {
  baru: ['Terakhir diubah', (a, b) => ts(b) - ts(a)],
  lama: ['Terlama diubah', (a, b) => ts(a) - ts(b)],
  nama: ['Nama A–Z', (a, b) => (a.nama || '').localeCompare(b.nama || '', 'id')],
  nomor: ['Nomor pekerjaan', (a, b) => (a.nomor || '').localeCompare(b.nomor || '', 'id', { numeric: true })],
  daya: ['Daya tertinggi', (a, b) => (Number(b.daya) || 0) - (Number(a.daya) || 0)],
  progres: ['Progres terendah', (a, b) => selesaiN(a) - selesaiN(b)],
}
// waktu perubahan terakhir (ms): ubahan lokal terbaru, atau waktu server, atau tanggal dibuat
function ts(p) { return Math.max(Number(p.localAt) || 0, Date.parse(p.updatedAt || p.updated_at) || 0, Date.parse(p.tanggal) || 0) }
const selesaiN = (p) => { if (!p.points) return 0; const st = stepStatus(p); return STEPS.filter((s) => st[s.key].done).length }

// Muat bertahap saat menggulir: tampilkan PAGE item dulu, tambah PAGE lagi tiap penanda bawah terlihat.
function useInfinite(total, resetKey) {
  const [shown, setShown] = useState(PAGE), sentinel = useRef(null)
  useEffect(() => { setShown(PAGE) }, [resetKey])
  useEffect(() => {
    const el = sentinel.current; if (!el || shown >= total) return
    const io = new IntersectionObserver((es) => es[0].isIntersecting && setShown((n) => Math.min(n + PAGE, total)), { rootMargin: '320px' })
    io.observe(el); return () => io.disconnect()
  }, [shown, total])
  return { shown, sentinel, more: shown < total }
}
// keadaan daftar (cari, filter, urutan) disimpan di URL agar tombol Kembali dan tautan tetap sama
const bacaUrl = () => { const u = new URLSearchParams(typeof location === 'undefined' ? '' : location.search); return { q: u.get('q') || '', status: u.get('status') || 'semua', sort: u.get('sort') || 'baru' } }

const tgl = (p) => (ts(p) ? new Date(ts(p)).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const sync = (p) => (!p.version ? ['warn', 'Belum terkirim'] : p.dirty ? ['warn', 'Menunggu sinkron'] : ['ok', 'Tersinkron'])
// langkah pertama yang belum lengkap = tempat melanjutkan pekerjaan
const lanjutDi = (p) => { const st = stepStatus(p); return STEPS.find((s) => st[s.key].ready && !st[s.key].done)?.key || 'ekspor' }

const FILTER_KEYS = ['semua', 'draft', 'final', 'sinkron', 'belum']
export default function Proyek({ go }) {
  const { state, copy, remove, finalize, reopen, openRemote, online, addDemo } = useApp()
  const { user, can: izin, canEdit: bisaUbah, canDelete: bisaHapus } = useAuth()
  const [dlg, setDlg] = useState(null) // { type: 'delete' | 'finalize' | 'reopen' | 'history', p }
  const [busy, setBusy] = useState(false)
  const init = useMemo(bacaUrl, []), [q, setQ] = useState(init.q), [filter, setFilter] = useState(FILTER_KEYS.includes(init.status) ? init.status : 'semua'), [sort, setSort] = useState(SORTS[init.sort] ? init.sort : 'baru'), [remote, setRemote] = useState([]), [err, setErr] = useState('')
  const all = state.projects
  const belum = (p) => !!p.dirty || !p.version
  const FILTERS = {
    semua: () => true,
    draft: (p) => p.status !== 'Selesai',
    final: (p) => p.status === 'Selesai',
    sinkron: (p) => !belum(p),
    belum,
  }
  const count = (k) => all.filter(FILTERS[k]).length
  const term = q.trim().toLowerCase()
  const list = useMemo(() => all.filter((p) => `${p.nomor} ${p.nama} ${p.lokasi} ${p.kode}`.toLowerCase().includes(term) && FILTERS[filter](p)).sort(SORTS[sort][1]), [all, term, filter, sort]) // eslint-disable-line
  const inf = useInfinite(list.length, `${term}|${filter}|${sort}`)
  const remoteSorted = useMemo(() => [...remote].sort(SORTS[sort][1]), [remote, sort])
  const infR = useInfinite(remoteSorted.length, `${term}|${sort}`)
  useEffect(() => { const u = new URLSearchParams(); q.trim() && u.set('q', q.trim()); filter !== 'semua' && u.set('status', filter); sort !== 'baru' && u.set('sort', sort); const qs = u.toString(); history.replaceState(history.state, '', location.pathname + (qs ? `?${qs}` : '')) }, [q, filter, sort])
  const kodeMatch = /([A-Za-z0-9_-]{8,32})\/?$/.exec(q.trim().replace(/[#?].*$/, '')) || /#\/p\/([A-Za-z0-9_-]{8,32})/.exec(q)
  const bisaBukaKode = term.length >= 8 && !/\s/.test(q.trim()) && !list.length && kodeMatch

  // Cari juga di server (semua project UP3) dan tampilkan yang belum ada di perangkat ini
  useEffect(() => {
    if (!online || q.trim().length < 2) return setRemote([])
    const t = setTimeout(() => api.get(`/api/proyek?q=${encodeURIComponent(q.trim())}`).then((r) => setRemote(r.filter((x) => !state.projects.some((p) => p.kode === x.kode)))).catch(() => setRemote([])), 350)
    return () => clearTimeout(t)
  }, [q, online, state.projects])

  const bukaKode = async (e) => {
    e?.preventDefault(); setErr('')
    if (!kodeMatch) return
    try { const d = await openRemote(kodeMatch[1]); setQ(''); go('data', null, d.kode) } catch { setErr(online ? 'Project dengan kode itu tidak ditemukan' : 'Butuh internet untuk membuka project dari server') }
  }
  const buka = (p, langkah) => go(langkah || lanjutDi(p), null, p.kode)

  const Item = ({ p, remoteRow }) => {
    const final = p.status === 'Selesai'
    const st = remoteRow ? null : stepStatus(p), selesai = st ? STEPS.filter((s) => st[s.key].done).length : 0
    const next = remoteRow ? null : lanjutDi(p), [tone, syncLabel] = remoteRow ? ['info', 'Di server'] : sync(p)
    const au = auditSummary(p), edit = !remoteRow && bisaUbah(p)
    return (
      <div className={`pitem ${!remoteRow && p.id === state.activeId ? 'act' : ''}`} data-testid="project-card">
        <div className="pitem-main">
          <h3>{p.jenis === 'Tambah Daya' ? 'TD' : 'PB'} · {p.nama}{p.daya ? ` · ${Number(p.daya).toLocaleString('id-ID')} VA` : ''}</h3>
          <div className="pmeta"><span>No. {p.nomor || '—'}</span>{p.lokasi && <span>{p.lokasi}</span>}</div>
          <div className="prow" style={{ marginTop: 8 }}>
            <Chip tone={final ? 'ok' : 'warn'}>{final ? 'Final' : 'Draft'}</Chip>
            <Chip tone={tone}>{syncLabel}</Chip>
            <span className="pmeta">{remoteRow ? `${p.titik} titik` : `${p.points.length} titik`}</span>
            <span className="code">{p.kode}</span>
          </div>
          {!remoteRow && <div className="pprog" title={`${selesai} dari ${STEPS.length} langkah lengkap`}><div className="pprog-bar"><i style={{ width: `${(selesai / STEPS.length) * 100}%` }} /></div><span>{selesai}/{STEPS.length} langkah</span></div>}
          {!remoteRow && (
            <dl className="paudit">
              <div><dt>Dibuat oleh</dt><dd>{au.created ? <><b>{au.created.by}</b><span>{fmtWaktu(au.created.at)}</span></> : <span>—</span>}</dd></div>
              {au.finalized && <div className="fin"><dt>Difinalisasi oleh</dt><dd><b>{au.finalized.by}</b><span>{fmtWaktu(au.finalized.at)}</span></dd></div>}
              <div><dt>Terakhir diubah</dt><dd>{au.edited ? <><b>{au.edited.by}</b><span>{fmtWaktu(au.edited.at)}</span></> : <span>{tgl(p) || '—'}</span>}</dd></div>
            </dl>
          )}
        </div>
        <div className="pitem-act">
          {remoteRow
            ? <Button size="sm" onClick={() => openRemote(p.kode).then((d) => go('data', null, d.kode))}>Buka</Button>
            : <>
              <Button size="sm" iconRight="chevR" onClick={() => buka(p, edit ? undefined : 'data')}>{!edit ? 'Buka' : selesai === STEPS.length ? 'Buka' : `Lanjutkan: ${STEPS.find((s) => s.key === next)?.short}`}</Button>
              {izin('project:create') && <Button size="sm" variant="secondary" onClick={() => copy(p.id)}>Salin</Button>}
              {!final && izin('project:finalize') && <Button size="sm" variant="secondary" onClick={() => setDlg({ type: 'finalize', p })}>Finalisasi</Button>}
              {final && izin('project:reopen') && <Button size="sm" variant="secondary" onClick={() => setDlg({ type: 'reopen', p })}>Buka kembali</Button>}
              {izin('audit:view') && <Button size="sm" variant="quiet" onClick={() => setDlg({ type: 'history', p })}>Riwayat</Button>}
              {bisaHapus(p) && <Button size="sm" variant="danger" aria-label={`Hapus project ${p.nomor}`} title="Hapus project" onClick={() => setDlg({ type: 'delete', p })}><Icon n="trash" size={14} /></Button>}
            </>}
        </div>
      </div>
    )
  }

  const tutup = () => !busy && setDlg(null)
  const jalankan = async () => {
    const { type, p } = dlg; setBusy(true)
    if (type === 'delete') await remove(p.id)
    if (type === 'finalize') finalize(p.id)
    if (type === 'reopen') reopen(p.id)
    setBusy(false); setDlg(null)
  }
  const Dialog = () => {
    if (!dlg) return null
    const { type, p } = dlg
    if (type === 'history') {
      const items = [...(p.audit || [])].reverse(), au = auditSummary(p)
      return (
        <Modal title={`Riwayat · ${p.nomor}`} onClose={tutup} footer={<Button variant="secondary" onClick={tutup}>Tutup</Button>}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>{p.nama}</p>
          <ol className="timeline">
            {au.edited && <li><span className="tl-dot edit" /><div><b>Terakhir diubah</b><span>{au.edited.by} · {fmtWaktu(au.edited.at)}</span></div></li>}
            {items.map((e) => (
              <li key={e.id}><span className={`tl-dot ${ACTION[e.action]?.tone || ''}`} /><div><b>{ACTION[e.action]?.label || e.action}</b><span>{e.by?.name}{e.by?.role && ROLES[e.by.role] ? ` (${ROLES[e.by.role].label})` : ''} · {fmtWaktu(e.at)}</span>{e.note && <em>{e.note}</em>}</div></li>
            ))}
            {!items.length && !au.edited && <li><div><span>Belum ada riwayat tercatat.</span></div></li>}
          </ol>
        </Modal>
      )
    }
    if (type === 'delete') return (
      <Modal title="Hapus project ini?" onClose={tutup}
        footer={<><Button variant="danger" disabled={busy} onClick={jalankan}>{busy ? 'Menghapus…' : 'Ya, hapus project'}</Button><Button variant="secondary" disabled={busy} onClick={tutup}>Batal</Button></>}>
        <div className="dlg-sum"><b>{p.nomor}</b><span>{p.nama}</span><span>{p.points.length} titik · {p.status === 'Selesai' ? 'Final' : 'Draft'}</span></div>
        <Alert tone="bad" title="Tindakan ini tidak dapat dibatalkan.">Seluruh titik, gambar skematik, RAB, dan foto project ini akan dihapus{p.version ? ' dari server dan perangkat ini' : ' dari perangkat ini'}.</Alert>
        {(p.dirty || !p.version) && <Alert tone="warn">Project ini punya perubahan yang belum tersinkron. Data tersebut ikut hilang.</Alert>}
      </Modal>
    )
    if (type === 'finalize') {
      const stp = stepStatus(p), belum = STEPS.filter((s) => !stp[s.key].done)
      return (
        <Modal title="Finalisasi project?" onClose={tutup}
          footer={<><Button disabled={busy || belum.length > 0} onClick={jalankan}>Ya, finalisasi</Button><Button variant="secondary" disabled={busy} onClick={tutup}>Batal</Button></>}>
          <div className="dlg-sum"><b>{p.nomor}</b><span>{p.nama}</span></div>
          {belum.length > 0
            ? <Alert tone="warn" title="Belum bisa difinalisasi.">Selesaikan langkah berikut dulu:<ul>{belum.map((s) => <li key={s.key}>{s.label}: {stp[s.key].todo[0]}</li>)}</ul></Alert>
            : <div className="infobox">Setelah Final, project <b>dikunci</b> dan tidak bisa diubah. Hanya peran dengan izin dapat membukanya kembali menjadi Draft.<br />Tercatat di riwayat: <b>{user?.name}</b>, {fmtWaktu(new Date().toISOString())}.</div>}
        </Modal>
      )
    }
    return (
      <Modal title="Buka kembali project?" onClose={tutup}
        footer={<><Button disabled={busy} onClick={jalankan}>Ya, jadikan Draft</Button><Button variant="secondary" disabled={busy} onClick={tutup}>Batal</Button></>}>
        <div className="dlg-sum"><b>{p.nomor}</b><span>{p.nama}</span></div>
        <div className="infobox">Status kembali menjadi <b>Draft</b> dan project bisa diubah lagi. Pembukaan kembali ini dicatat atas nama <b>{user?.name}</b>.</div>
      </Modal>
    )
  }

  return (
    <>
      <PageHeader title="Project Survei" desc="Pilih project untuk dilanjutkan, atau mulai survei pelanggan baru.">
        {izin('project:create') && <Button icon="plus" onClick={() => go('data', 'baru')}>Project baru</Button>}
      </PageHeader>

      {all.length > 0 && (
        <>
          <div className="qf" role="group" aria-label="Filter cepat project">
            {[['semua', 'Semua project', 'folder'], ['draft', 'Draft', 'sheet'], ['final', 'Final', 'check'], ['sinkron', 'Tersinkron', 'wifi'], ['belum', 'Belum tersinkron', 'wifioff']].map(([k, label, ic]) => (
              <button key={k} type="button" className={`qf-i ${k} ${filter === k ? 'on' : ''} ${k === 'belum' && count(k) ? 'alert' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(filter === k && k !== 'semua' ? 'semua' : k)}>
                <span className="qf-top"><Icon n={ic} size={15} /><span className="qf-l">{label}</span></span>
                <b>{count(k)}</b>
              </button>
            ))}
          </div>

          <form className="searchbar" role="search" onSubmit={bukaKode}>
            <Icon n="search" size={19} />
            <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setErr('') }} placeholder="Cari nama pelanggan, nomor pekerjaan, atau lokasi" aria-label="Cari project" />
            {q && <button type="button" className="searchbar-x" aria-label="Hapus pencarian" onClick={() => setQ('')}><Icon n="x" size={16} /></button>}
          </form>
          <div className="resultline" aria-live="polite">
            <span>{list.length === all.length && !term ? `${all.length} project` : `Menampilkan ${list.length} dari ${all.length} project`}</span>
            {(filter !== 'semua' || term) && <button type="button" className="linkbtn" onClick={() => { setFilter('semua'); setQ('') }}>Reset</button>}
            <label className="sortsel"><span>Urutkan</span>
              <Select value={sort} onChange={(e) => setSort(e.target.value)} options={Object.entries(SORTS).map(([v, [l]]) => ({ v, l }))} aria-label="Urutkan project" /></label>
          </div>
        </>
      )}
      {bisaBukaKode && (
        <button type="button" className="codehit" onClick={bukaKode}><Icon n="folder" size={18} /><span>Buka project dengan kode <b>{kodeMatch[1]}</b></span><Icon n="chevR" size={16} /></button>
      )}
      {err && <Alert tone="bad">{err}</Alert>}

      <div className="plist">{list.slice(0, inf.shown).map((p) => <Fragment key={p.id}>{Item({ p })}</Fragment>)}</div>
      {list.length > 0 && (
        <div className="loadmore" ref={inf.sentinel} aria-live="polite">
          {inf.more ? <><span className="spin" />Memuat project berikutnya…</> : list.length > PAGE ? `Semua ${list.length} project sudah ditampilkan` : null}
        </div>
      )}

      {!all.length && (
        <Card><EmptyState icon="folder" actions={<>
          {izin('project:create') && <><Button icon="plus" onClick={() => go('data', 'baru')}>Buat project pertama</Button>
          <Button variant="secondary" onClick={() => go('peta', null, addDemo())}>Coba dengan project contoh</Button></>}</>}>
          Belum ada project di perangkat ini. Buat project baru untuk mulai survei, atau buka project dengan kode/link dari rekan.</EmptyState></Card>
      )}
      {all.length > 0 && !list.length && !remote.length && !bisaBukaKode && <Card><EmptyState icon="search" actions={<Button variant="secondary" onClick={() => { setFilter('semua'); setQ('') }}>Reset filter</Button>}>Tidak ada project yang cocok{q ? ` dengan “${q}”` : ''}.</EmptyState></Card>}

      {remote.length > 0 && <>
        <h2 className="sect-h">Ditemukan di server</h2>
        <div className="plist">{remoteSorted.slice(0, infR.shown).map((p) => <Fragment key={p.kode}>{Item({ p, remoteRow: true })}</Fragment>)}</div>
        {infR.more && <div className="loadmore" ref={infR.sentinel}><span className="spin" />Memuat…</div>}
      </>}
      {Dialog()}
    </>
  )
}
