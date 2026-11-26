import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Provider, useApp } from './store'
import { Icon, Logo, Button, Modal, Card, Chip, EmptyState, Alert } from './components/ui'
import { Stepper, StepFooter } from './components/Stepper'
import { StepGuide } from './components/StepGuide'
import Data from './views/Data'
import Offline from './views/Offline'
import Ekspor from './views/Ekspor'
import Peta from './views/Peta'
import Proyek from './views/Proyek'
import Gambar from './views/Gambar'
import Rab from './views/Rab'
import { loadMaster } from './lib/konstruksi'
import { AuthProvider, useAuth } from './lib/authContext'
import Login, { nextDariUrl } from './views/Login'
import { ROLES, alasanReadOnly } from './lib/auth'
import { stepStatus, STEPS } from './lib/steps'
import { parseRoute, pathFor } from './lib/routes'

const PAGES = { data: Data, peta: Peta, gambar: Gambar, rab: Rab, ekspor: Ekspor, project: Proyek, offline: Offline }

function SyncPill({ onClick, active }) {
  const { online, serverUp, syncing, pending } = useApp()
  const [s, label] = !online ? ['off', 'Offline'] : syncing ? ['busy', 'Menyinkronkan…'] : pending ? ['wait', `${pending} menunggu`] : serverUp ? ['ok', 'Tersinkron'] : ['wait', 'Server belum terjangkau']
  return <button type="button" className={`pill sync ${s} ${active ? 'on' : ''}`} onClick={onClick} title="Status sinkron dan peta offline"><i />{label}<Icon n="chevR" size={13} /></button>
}

function UserMenu() {
  const { user, logout } = useAuth(), router = useRouter(), [open, setOpen] = useState(false), ref = useRef(null)
  useEffect(() => { const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false); document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [])
  if (!user) return null
  const ini = user.name.split(' ').map((x) => x[0]).slice(0, 2).join('')
  return (
    <div className="umenu" ref={ref}>
      <button type="button" className="uchip" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="Menu pengguna">
        <span className="uav">{ini}</span><span className="utx"><b>{user.name}</b><small>{ROLES[user.role]?.label}</small></span>
      </button>
      {open && (
        <div className="upop" role="menu">
          <div className="upop-h"><span className="uav lg">{ini}</span><div><b>{user.name}</b><small>{user.email}</small><Chip tone="info">{ROLES[user.role]?.label}</Chip></div></div>
          <p className="upop-d">{ROLES[user.role]?.desc}</p>
          <Button variant="secondary" className="upop-out" onClick={() => { setOpen(false); logout(); router.replace('/login') }}>Keluar</Button>
        </div>
      )}
    </div>
  )
}

function ConflictModal() {
  const { conflict, resolve } = useApp()
  if (!conflict) return null
  const s = conflict.server
  return (
    <Modal title="Project diubah di perangkat lain"
      footer={<>
        <Button onClick={() => resolve('lokal')}>Pakai versi saya (timpa server)</Button>
        <Button variant="secondary" onClick={() => resolve('server')}>Pakai versi server (buang perubahan saya)</Button>
      </>}>
      <p style={{ margin: 0 }}>Project <b>{s.nomor}</b> ({s.nama}) sudah berubah di server sejak Anda terakhir sinkron. Pilih satu versi yang dipakai.</p>
      <div className="infobox"><b>Versi server:</b> {s.points.length} titik, versi {s.version}<br /><b>Versi di perangkat ini:</b> perubahan Anda yang belum terkirim</div>
    </Modal>
  )
}

function Shell() {
  const { active, state, setActive, openRemote, saveNow, toggleGuide } = useApp()
  const { user, can: izin, canEdit: bisaUbah } = useAuth()
  const pathname = usePathname(), router = useRouter()
  const view = useMemo(() => parseRoute(pathname), [pathname])
  const [saving, setSaving] = useState(false), [snack, setSnack] = useState(null), [leave, setLeave] = useState(false), [loadErr, setLoadErr] = useState(null)
  const prevPath = useRef('/'), lastPath = useRef(pathname)
  useEffect(() => { if (lastPath.current !== pathname) { prevPath.current = lastPath.current; lastPath.current = pathname } }, [pathname])

  const go = (page, opt = null, kode) => { router.push(pathFor(page, { opt, kode: kode || active?.kode })); window.scrollTo?.(0, 0) }
  const showSnack = (tone, t) => { setSnack({ tone, t }); setTimeout(() => setSnack(null), 4500) }

  // tautan lama #/p/KODE -> alamat baru
  useEffect(() => { let k = null; try { k = sessionStorage.getItem('pln-legacy-kode'); sessionStorage.removeItem('pln-legacy-kode') } catch { /* abaikan */ } if (k) router.replace(`/project/${k}/data`) }, []) // eslint-disable-line
  useEffect(() => { if (view.redirect) router.replace(pathFor('data', { kode: view.kode })) }, [view.redirect, view.kode]) // eslint-disable-line
  // alamat /project/<kode>/... menentukan project aktif; bila belum ada di perangkat, ambil dari server
  useEffect(() => {
    if (!view.kode) return setLoadErr(null)
    const local = state.projects.find((p) => p.kode === view.kode)
    if (local) { if (local.id !== state.activeId) setActive(local.id); return setLoadErr(null) }
    let hidup = true; setLoadErr('loading')
    openRemote(view.kode).then(() => hidup && setLoadErr(null)).catch(() => hidup && setLoadErr('notfound'))
    return () => { hidup = false }
  }, [view.kode, state.projects.length]) // eslint-disable-line

  const baru = view.page === 'data' && view.opt === 'baru'
  const home = view.page === 'project', util = view.page === 'offline', notfound = view.page === 'notfound'
  const inProject = !home && !util && !notfound
  const siap = !view.kode || (active?.kode === view.kode && loadErr !== 'loading')
  const readOnly = inProject && !baru && !!active && siap && !bisaUbah(active)
  const alasan = readOnly ? alasanReadOnly(user, active) : null
  const statusAsli = stepStatus(view.kode ? active : null)
  // lihat-saja: semua langkah boleh dibuka (tidak ada yang bisa diselesaikan)
  const status = readOnly ? Object.fromEntries(Object.entries(statusAsli).map(([k, v]) => [k, { ...v, ready: true }])) : statusAsli
  const kunci = readOnly && ['data', 'peta', 'gambar', 'rab'].includes(view.page)
  const dilarangBaru = baru && !izin('project:create')
  // alamat langkah yang masih terkunci (mis. diketik langsung) dialihkan ke langkah pertama yang belum lengkap
  useEffect(() => {
    if (!inProject || baru || !siap || !active || readOnly || !statusAsli[view.page] || statusAsli[view.page].ready) return
    const target = STEPS.find((s) => statusAsli[s.key].ready && !statusAsli[s.key].done)?.key || 'data'
    showSnack('warn', 'Selesaikan langkah sebelumnya dulu.')
    router.replace(pathFor(target, { kode: active.kode }))
  }, [view.page, siap, active?.kode, JSON.stringify(Object.values(statusAsli).map((x) => x.ready))]) // eslint-disable-line
  const Page = PAGES[view.page]

  useEffect(() => {
    const nama = { project: 'Daftar project', offline: 'Offline & Sinkron', notfound: 'Tidak ditemukan' }[view.page] || STEPS.find((x) => x.key === view.page)?.label
    document.title = `${baru ? 'Project baru' : nama}${view.kode && active ? ` · ${active.nama}` : ''} · Survei PLN`
  }, [view.page, view.kode, baru, active?.nama]) // eslint-disable-line

  // Kembali ke daftar: dari dalam project selalu minta konfirmasi (project tersimpan sebagai Draft)
  const keDaftar = () => { if (inProject && (baru || (!readOnly && active?.status !== 'Selesai'))) setLeave(true); else go('project') }
  const keluarDraft = async () => {
    if (baru || !active) { setLeave(false); return go('project') }
    setSaving(true); const r = await saveNow(active.id); setSaving(false); setLeave(false)
    showSnack(r === 'tersinkron' ? 'ok' : 'warn', r === 'tersinkron' ? `Project ${active.nomor} disimpan sebagai Draft.` : `Project ${active.nomor} disimpan sebagai Draft di perangkat. Akan dikirim saat jaringan kembali.`)
    go('project')
  }
  const simpan = async () => {
    if (!active) return
    setSaving(true); const r = await saveNow(active.id); setSaving(false)
    showSnack(r === 'tersinkron' ? 'ok' : 'warn', r === 'tersinkron' ? `Project ${active.nomor} tersimpan dan tersinkron.` : `Project ${active.nomor} tersimpan di perangkat. Akan dikirim saat jaringan kembali.`)
    go('project')
  }
  return (
    <div className="rapp">
      <header className="rhdr">
        <button className="rbrand" onClick={keDaftar} aria-label="Ke daftar project">
          <div className="logo-wrap"><img src="/logo-icon.png" alt="Logo PLN" /></div>
          <div className="rbrand-t"><b><span className="t-s">Survei TD &amp; PB</span><span className="t-l">Survei Tambah Daya &amp; Pasang Baru</span></b><span>PT PLN (Persero) · UP3 Klaten</span></div>
        </button>
        <div className="rhdr-r"><SyncPill onClick={() => go('offline')} active={util} /><UserMenu /></div>
      </header>
      {util && <div className="stepbar util"><div className="stepbar-in"><Button variant="secondary" size="sm" icon="chevL" onClick={() => router.push(prevPath.current && prevPath.current !== '/offline' ? prevPath.current : '/')}>Kembali</Button></div></div>}
      {inProject && <Stepper page={view.page} status={status} project={baru ? null : active} go={go} onHome={keDaftar} />}
      <div className={`rbody ${view.page === 'rab' || view.page === 'peta' ? 'wide' : ''} ${view.page === 'peta' ? 'peta' : ''}`}>
        {inProject && siap && <StepGuide page={view.page} project={baru ? null : active} onToggle={toggleGuide} />}
        <main className="rmain">
          {notfound && <Card><EmptyState icon="folder" actions={<Button onClick={() => go('project')}>Ke daftar project</Button>}>Halaman tidak ditemukan.</EmptyState></Card>}
          {!notfound && !siap && (loadErr === 'notfound'
            ? <Card><EmptyState icon="search" actions={<Button onClick={() => go('project')}>Ke daftar project</Button>}>Project dengan kode <b>{view.kode}</b> tidak ditemukan{typeof navigator !== 'undefined' && !navigator.onLine ? ' (perangkat sedang offline)' : ''}.</EmptyState></Card>
            : <div className="gate"><span className="spin" /><p>Membuka project…</p></div>)}
          {readOnly && <Alert tone="info" title="Mode lihat saja">{alasan}</Alert>}
          {dilarangBaru && <Card><EmptyState icon="folder" actions={<Button onClick={() => go('project')}>Ke daftar project</Button>}>Peran {ROLES[user?.role]?.label} tidak dapat membuat project baru.</EmptyState></Card>}
          {!notfound && siap && Page && !dilarangBaru && <fieldset className="ro" disabled={kunci}><Page key={pathname} go={go} opt={view.opt} onLeave={keDaftar} /></fieldset>}
        </main>
      </div>
      {inProject && !baru && siap && <StepFooter page={view.page} status={status} go={go} onSave={simpan} saving={saving} readOnly={readOnly} />}
      {snack && <div className={`snack ${snack.tone}`} role="status"><Icon n="check" size={16} />{snack.t}</div>}
      {leave && (
        <Modal title={baru ? 'Batalkan project baru?' : 'Keluar dari project ini?'} onClose={() => setLeave(false)}
          footer={baru
            ? <><Button variant="danger" onClick={keluarDraft}>Ya, buang data</Button><Button variant="secondary" onClick={() => setLeave(false)}>Lanjut mengisi</Button></>
            : <><Button disabled={saving} onClick={keluarDraft}>{saving ? 'Menyimpan…' : 'Simpan sebagai Draft & keluar'}</Button><Button variant="secondary" onClick={() => setLeave(false)}>Tetap di sini</Button></>}>
          {baru
            ? <p style={{ margin: 0 }}>Data pelanggan yang sudah Anda isi belum tersimpan dan akan dibuang.</p>
            : <>
              <p style={{ margin: 0 }}>Project <b>{active?.nomor}</b> ({active?.nama}) akan disimpan dengan status <Chip tone="warn">Draft</Chip></p>
              <div className="infobox">Semua isian dan titik yang sudah ada tetap tersimpan. Anda bisa melanjutkannya kapan saja lewat tombol <b>Lanjutkan</b> di daftar project. Status baru menjadi <b>Final</b> setelah Anda menekan Finalisasi.</div>
            </>}
        </Modal>
      )}
    </div>
  )
}

function Gate() {
  const [st, setSt] = useState('load')
  const run = () => { setSt('load'); loadMaster().then((r) => setSt(r.ok ? 'ok' : 'err')) }
  useEffect(run, [])
  if (st === 'ok') return <Provider><Shell /></Provider>
  return (
    <div className="gate">
      <Logo />
      {st === 'load' ? <p>Memuat data master…</p> : <>
        <p><b>Data master belum tersedia.</b><br />Server belum terhubung dan belum ada salinan di perangkat ini. Pastikan server berjalan dan data Excel sudah diimpor, lalu coba lagi.</p>
        <Button onClick={run}>Coba lagi</Button>
      </>}
    </div>
  )
}
function Root() {
  const { user, ready } = useAuth(), pathname = usePathname(), router = useRouter(), isLogin = pathname === '/login'
  useEffect(() => {
    if (!ready) return
    if (!user && !isLogin) router.replace(`/login?next=${encodeURIComponent(pathname + location.search)}`)
    if (user && isLogin) router.replace(nextDariUrl())
  }, [ready, user, isLogin, pathname]) // eslint-disable-line
  if (!ready) return <div className="gate"><span className="spin" /></div>
  if (isLogin) return user ? null : <Login />
  return user ? <Gate /> : null
}
export default function App() { return <AuthProvider><Root /></AuthProvider> }
