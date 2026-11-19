import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createRealtime } from './lib/realtime'
import { api } from './lib/api'
import { deflection } from './lib/geo'
import { pickKode } from './lib/konstruksi'
import { isTajamPoint } from './lib/tajam'
import { demoProject } from './lib/seed'
import { useAuth } from './lib/authContext'
import { canEditProject, canDeleteProject, can } from './lib/auth'
import { auditEntry, actorOf } from './lib/audit'
import { fotoPut, fotoGet, fotoDel, kompresFoto } from './lib/fotoStore'

const Ctx = createContext(null)
const KEY = 'pln-survey-v2'
const CLIENT_ID = (() => { try { let c = localStorage.getItem('pln-client'); if (!c) { c = crypto.randomUUID(); localStorage.setItem('pln-client', c) } return c } catch { return crypto.randomUUID() } })()
const randKode = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return Array.from(a, (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('') + 'x2' }

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch { /* abaikan */ }
  return { projects: [], activeId: null }
}

// Hitung ulang sudut & kode otomatis. Kode yang diubah manual (kodeManual) tidak ditimpa.
export function recompute(project) {
  const pts = project.points.map((p, i, a) => {
    const sudut = deflection(a[i - 1], p, a[i + 1])
    return { ...p, sudut, kode: pickKode(sudut, project.jalur) }
  })
  return { ...project, points: pts }
}
export const isTajam = isTajamPoint
export const linkOf = (p) => `${location.origin}/project/${p.kode}/data`

export function Provider({ children }) {
  const { user } = useAuth()
  const userRef = useRef(user); userRef.current = user
  const [state, setState] = useState(load)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [serverUp, setServerUp] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [conflict, setConflict] = useState(null)
  const stateRef = useRef(state); stateRef.current = state
  const inflight = useRef(new Set()), timers = useRef({}), sock = useRef(null)

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* kuota */ } }, [state])
  const patch = useCallback((id, fn) => setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? fn(p) : p)) })), [])

  // ---- kirim ke server (antrean sinkron: proyek yang `dirty` dikirim saat online)
  const push = useCallback(async (id, force = false) => {
    const p = stateRef.current.projects.find((x) => x.id === id)
    if (!p || !p.dirty || inflight.current.has(id) || !navigator.onLine) return
    inflight.current.add(id); setSyncing(true)
    const sentAt = p.localAt; let hasil = 'gagal'
    try {
      const { dirty, localAt, foto, ...doc } = p
      const res = await api.put(`/api/proyek/${p.kode}${force ? '?force=1' : ''}`, { ...doc, baseVersion: p.version || 0 }, { headers: { 'x-client-id': CLIENT_ID } })
      setServerUp(true)
      patch(id, (x) => ({ ...x, version: res.version, dirty: x.localAt > sentAt })); hasil = 'ok'
      
    } catch (e) {
      if (e.status === 409) { setConflict({ id, server: e.data.server }); hasil = 'konflik' }
      else if (!e.status) setServerUp(false)
    } finally { inflight.current.delete(id); setSyncing(false) }
    const again = stateRef.current.projects.find((x) => x.id === id)
    if (again?.dirty && !conflict) schedule(id)
    return hasil
  }, [patch, conflict]) // eslint-disable-line
  const schedule = useCallback((id) => { clearTimeout(timers.current[id]); timers.current[id] = setTimeout(() => push(id), 700) }, [push])

  // Ubah project (izin dicek: hanya peran yang boleh mengubah project ini). Mencatat "terakhir diubah oleh".
  const update = useCallback((id, fn) => {
    const cur = stateRef.current.projects.find((p) => p.id === id)
    if (!cur || !canEditProject(userRef.current, cur)) return
    const now = new Date().toISOString(), by = actorOf(userRef.current)
    setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...recompute(typeof fn === 'function' ? fn(p) : { ...p, ...fn }), lastEditedBy: by, lastEditedAt: now, dirty: true, localAt: Date.now() } : p)) }))
    schedule(id)
  }, [schedule])
  // Perubahan tingkat-status (finalisasi, buka kembali): lewat izin sendiri, bukan izin ubah isi
  const setStatus = useCallback((id, status, entry, extra) => {
    const now = new Date().toISOString(), by = actorOf(userRef.current)
    setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, status, ...extra(by, now), lastEditedBy: by, lastEditedAt: now, audit: [...(p.audit || []), entry], dirty: true, localAt: Date.now() } : p)) }))
    schedule(id)
  }, [schedule])

  // ---- ambil dari server
  const pull = useCallback(async (kode) => {
    const doc = await api.get(`/api/proyek/${kode}`)
    const foto = await api.get(`/api/proyek/${kode}/foto`).catch(() => [])
    return { ...recompute(doc), dirty: false, localAt: 0, foto: foto.map((f) => (typeof f === 'string' ? { id: f } : f)) }
  }, [])
  const openRemote = useCallback(async (kode) => {
    const doc = await pull(kode)
    setState((s) => ({ ...s, activeId: doc.id, projects: s.projects.some((p) => p.id === doc.id) ? s.projects.map((p) => (p.id === doc.id ? doc : p)) : [doc, ...s.projects] }))
    return doc
  }, [pull])

  // ---- koneksi, real time
  useEffect(() => {
    const on = () => { setOnline(true); stateRef.current.projects.forEach((p) => p.dirty && push(p.id)) }
    const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    const handle = async (m) => {
      const p = stateRef.current.projects.find((x) => x.kode === m.kode)
      if (!p || m.from === CLIENT_ID) return
      if (m.foto) { const foto = await api.get(`/api/proyek/${m.kode}/foto`).catch(() => null); foto && patch(p.id, (x) => ({ ...x, foto: foto.map((f) => (typeof f === 'string' ? { id: f } : f)) })); return }
      if (p.dirty || m.version <= (p.version || 0)) return // bentrok ditangani saat kirim (pop-up pilih versi)
      try { const doc = await pull(m.kode); patch(p.id, () => doc) } catch { /* abaikan */ }
    }
    const s = createRealtime({ onChange: handle, onStatus: setServerUp }); sock.current = s
    api.get('/api/health').then(() => { setServerUp(true); stateRef.current.projects.forEach((p) => p.dirty && push(p.id)) }).catch(() => setServerUp(false))
    stateRef.current.projects.forEach((p) => p.dirty && push(p.id))
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); s.close() }
  }, []) // eslint-disable-line

  const uploadFoto = useCallback(async (p, meta, blob) => {
    try {
      await api.post(`/api/proyek/${p.kode}/foto`, blob, { headers: { 'Content-Type': blob.type || 'image/jpeg', 'x-foto-id': meta.id, 'x-foto-meta': JSON.stringify(meta) }, timeout: 30000 })
      patch(p.id, (x) => ({ ...x, foto: (x.foto || []).map((f) => (f.id === meta.id ? { ...f, pending: false } : f)) }))
    } catch { /* tetap pending, dicoba lagi saat online */ }
  }, [patch])

  // unggah foto yang masih menunggu (project sudah punya versi di server dan perangkat online)
  const fotoJalan = useRef(new Set())
  useEffect(() => {
    if (!online) return
    state.projects.forEach((p) => {
      if (!p.version) return
      ;(p.foto || []).filter((f) => f.pending && !fotoJalan.current.has(f.id)).forEach(async (f) => {
        fotoJalan.current.add(f.id)
        const blob = await fotoGet(f.id); if (blob) await uploadFoto(p, f, blob)
        fotoJalan.current.delete(f.id)
      })
    })
  }, [state, online, uploadFoto])

  const api2 = useMemo(() => ({
    user, state, active: state.projects.find((p) => p.id === state.activeId) || state.projects[0] || null,
    online, serverUp, syncing, conflict, update, openRemote,
    pending: state.projects.filter((p) => p.dirty).length,
    setActive: (id) => setState((s) => ({ ...s, activeId: id })),
    add: (data) => {
      if (!can(userRef.current, 'project:create')) return null
      const id = crypto.randomUUID(), n = state.projects.length + 1, now = new Date().toISOString(), by = actorOf(userRef.current)
      const p = { id, kode: randKode(), version: 0, dirty: true, localAt: Date.now(), nomor: `${data.jenis === 'Tambah Daya' ? 'TD' : 'PB'}-2026-${String(n).padStart(3, '0')}`,
        status: 'Draft', tanggal: now.slice(0, 10), points: [], crossings: [], jalur: 'KONSTRUKSI JTM 3 FASA PADA TIANG BETON',
        meta: { noGambar: '', skala: '1 : 500', perihal: data.jenis, digambar: '', diperiksa: '', diketahui: '', disetujui: '' },
        rabOpt: { harga: 'HSS', jenis: 'Total', asal: 'Gudang UP3', slo: true }, priceEdits: {}, labelPos: {}, foto: [], guide: {},
        createdBy: by, createdAt: now, lastEditedBy: by, lastEditedAt: now, audit: [auditEntry('created', userRef.current)], ...data }
      setState((s) => ({ ...s, projects: [p, ...s.projects], activeId: id })); schedule(id); return p.kode
    },
    addDemo: () => {
      if (!can(userRef.current, 'project:create')) return null
      const now = new Date().toISOString(), by = actorOf(userRef.current)
      const p = recompute({ ...demoProject(), createdBy: by, createdAt: now, lastEditedBy: by, lastEditedAt: now, audit: [auditEntry('created', userRef.current, 'Project contoh')] })
      setState((s) => ({ ...s, projects: [{ ...p, dirty: true, localAt: Date.now() }, ...s.projects], activeId: p.id })); schedule(p.id); return p.kode
    },
    copy: async (id) => {
      const src = stateRef.current.projects.find((p) => p.id === id); if (!src || !can(userRef.current, 'project:create')) return
      const now = new Date().toISOString(), by = actorOf(userRef.current), jejak = [auditEntry('copied', userRef.current, `Salinan dari ${src.nomor}`)]
      if (src.version && navigator.onLine && !src.dirty) { try { const d = await api.post(`/api/proyek/${src.kode}/salin`, { by, at: now }); await openRemote(d.kode); return } catch { /* turun ke salin lokal */ } }
      const nid = crypto.randomUUID()
      const c = { ...JSON.parse(JSON.stringify(src)), id: nid, kode: randKode(), version: 0, dirty: true, localAt: Date.now(), nomor: (src.nomor || '') + '-SALIN', status: 'Draft', nama: src.nama + ' (salinan)',
        points: src.points.map((p) => ({ ...p, id: crypto.randomUUID() })), foto: [], guide: {}, createdBy: by, createdAt: now, lastEditedBy: by, lastEditedAt: now, finalizedBy: undefined, finalizedAt: undefined, audit: jejak }
      setState((s) => ({ ...s, activeId: nid, projects: [c, ...s.projects] })); schedule(nid)
    },
    remove: async (id) => {
      const p = stateRef.current.projects.find((x) => x.id === id)
      if (!canDeleteProject(userRef.current, p)) return false
      if (p?.version && navigator.onLine) await api.del(`/api/proyek/${p.kode}`, { headers: { 'x-client-id': CLIENT_ID } }).catch(() => {})
      setState((s) => { const rest = s.projects.filter((x) => x.id !== id); return { ...s, projects: rest, activeId: s.activeId === id ? rest[0]?.id || null : s.activeId } })
      return true
    },
    finalize: (id) => {
      const p = stateRef.current.projects.find((x) => x.id === id)
      if (!p || p.status === 'Selesai' || !can(userRef.current, 'project:finalize')) return false
      setStatus(id, 'Selesai', auditEntry('finalized', userRef.current), (by, at) => ({ finalizedBy: by, finalizedAt: at })); return true
    },
    reopen: (id) => {
      const p = stateRef.current.projects.find((x) => x.id === id)
      if (!p || p.status !== 'Selesai' || !can(userRef.current, 'project:reopen')) return false
      setStatus(id, 'Draft', auditEntry('reopened', userRef.current), () => ({ finalizedBy: undefined, finalizedAt: undefined })); return true
    },
    // foto per pekerjaan: dikompres, disimpan di perangkat (IndexedDB), diunggah saat online
    addFoto: async (id, file) => {
      const p = stateRef.current.projects.find((x) => x.id === id); if (!p || !canEditProject(userRef.current, p)) return
      const blob = await kompresFoto(file), fid = crypto.randomUUID(), meta = { id: fid, by: actorOf(userRef.current), at: new Date().toISOString(), name: file.name || 'foto.jpg' }
      await fotoPut(fid, blob)
      patch(id, (x) => ({ ...x, foto: [...(x.foto || []), { ...meta, pending: true }] }))
    },
    removeFoto: async (id, fid) => {
      const p = stateRef.current.projects.find((x) => x.id === id); if (!p || !canEditProject(userRef.current, p)) return
      const f = (p.foto || []).find((x) => x.id === fid)
      patch(id, (x) => ({ ...x, foto: (x.foto || []).filter((y) => y.id !== fid) })); fotoDel(fid)
      if (f && !f.pending && navigator.onLine) api.del(`/api/foto/${fid}`).catch(() => {})
    },
    resolve: async (pakai) => {
      const c = conflict; if (!c) return
      setConflict(null)
      if (pakai === 'server') { const doc = await pull(c.server.kode); patch(c.id, () => doc) }
      else { patch(c.id, (x) => ({ ...x, version: c.server.version, dirty: true, localAt: Date.now() })); setTimeout(() => push(c.id, true), 50) }
    },
    // Simpan sekarang: kirim ke server tanpa menunggu jeda otomatis. Hasil: 'tersinkron' | 'di-perangkat' (offline/server belum terjangkau) | 'konflik'
    // Centang butir panduan (manual) dan penandaan otomatis oleh aksi (mis. tombol Selesai, Unduh Excel)
    toggleGuide: (id, key) => update(id, (x) => ({ ...x, guide: { ...x.guide, [key]: !x.guide?.[key] } })),
    markGuide: (id, key) => { const p = stateRef.current.projects.find((x) => x.id === id); if (p && !p.guide?.[key]) update(id, (x) => ({ ...x, guide: { ...x.guide, [key]: true } })) },
    saveNow: async (id) => {
      clearTimeout(timers.current[id])
      const r = await push(id)
      if (r === 'ok') return 'tersinkron'
      if (r === 'konflik') return 'konflik'
      const p = stateRef.current.projects.find((x) => x.id === id)
      return p && !p.dirty && p.version ? 'tersinkron' : 'di-perangkat'
    },
    reset: () => setState({ projects: [], activeId: null }),
  }), [state, online, serverUp, syncing, conflict, update, openRemote, push, schedule, pull, patch])
  return <Ctx.Provider value={api2}>{children}</Ctx.Provider>
}
export const useApp = () => useContext(Ctx)
