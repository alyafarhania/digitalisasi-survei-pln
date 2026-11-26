import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { DEMO } from './lib/api'
import { api } from './lib/api'
import { deflection } from './lib/geo'
import { pickKode, maxSudut } from './lib/konstruksi'
import { demoProject } from './lib/seed'

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
export const isTajam = (project, p) => p.sudut > maxSudut(project.jalur)
export const linkOf = (p) => `${location.origin}/#/p/${p.kode}`

export function Provider({ children }) {
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
    const sentAt = p.localAt
    try {
      const { dirty, localAt, foto, ...doc } = p
      const res = await api.put(`/api/proyek/${p.kode}${force ? '?force=1' : ''}`, { ...doc, baseVersion: p.version || 0 }, { headers: { 'x-client-id': CLIENT_ID } })
      setServerUp(true)
      patch(id, (x) => ({ ...x, version: res.version, dirty: x.localAt > sentAt }))
      sock.current?.emit('join', p.kode)
    } catch (e) {
      if (e.status === 409) setConflict({ id, server: e.data.server })
      else if (!e.status) setServerUp(false)
    } finally { inflight.current.delete(id); setSyncing(false) }
    const again = stateRef.current.projects.find((x) => x.id === id)
    if (again?.dirty && !conflict) schedule(id)
  }, [patch, conflict]) // eslint-disable-line
  const schedule = useCallback((id) => { clearTimeout(timers.current[id]); timers.current[id] = setTimeout(() => push(id), 700) }, [push])

  const update = useCallback((id, fn) => {
    setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...recompute(typeof fn === 'function' ? fn(p) : { ...p, ...fn }), dirty: true, localAt: Date.now() } : p)) }))
    schedule(id)
  }, [schedule])

  // ---- ambil dari server
  const pull = useCallback(async (kode) => {
    const doc = await api.get(`/api/proyek/${kode}`)
    const foto = await api.get(`/api/proyek/${kode}/foto`).catch(() => [])
    return { ...recompute(doc), dirty: false, localAt: 0, foto: foto.map((id) => ({ id, src: `/api/foto/${id}` })) }
  }, [])
  const openRemote = useCallback(async (kode) => {
    const doc = await pull(kode)
    setState((s) => ({ ...s, activeId: doc.id, projects: s.projects.some((p) => p.id === doc.id) ? s.projects.map((p) => (p.id === doc.id ? doc : p)) : [doc, ...s.projects] }))
    sock.current?.emit('join', kode); return doc
  }, [pull])

  // ---- koneksi, real time
  useEffect(() => {
    const on = () => { setOnline(true); stateRef.current.projects.forEach((p) => p.dirty && push(p.id)) }
    const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    const s = DEMO ? { on() {}, off() {}, emit() {}, disconnect() {}, close() {} } : io({ transports: ['websocket', 'polling'], reconnectionDelay: 2000 }); sock.current = s
    const joinAll = () => stateRef.current.projects.filter((p) => p.version).forEach((p) => s.emit('join', p.kode))
    s.on('connect', () => { setServerUp(true); joinAll(); stateRef.current.projects.forEach((p) => p.dirty && push(p.id)) })
    s.on('disconnect', () => setServerUp(false))
    s.on('proyek:diubah', async (m) => {
      const p = stateRef.current.projects.find((x) => x.kode === m.kode)
      if (!p || m.from === CLIENT_ID) return
      if (m.foto) { const foto = await api.get(`/api/proyek/${m.kode}/foto`).catch(() => null); foto && patch(p.id, (x) => ({ ...x, foto: foto.map((id) => ({ id, src: `/api/foto/${id}` })) })); return }
      if (p.dirty || m.version <= (p.version || 0)) return // bentrok ditangani saat kirim (pop-up pilih versi)
      try { const doc = await pull(m.kode); patch(p.id, () => doc) } catch { /* abaikan */ }
    })
    stateRef.current.projects.forEach((p) => p.dirty && push(p.id))
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); s.close() }
  }, []) // eslint-disable-line

  // buka dari link #/p/KODE
  useEffect(() => {
    const m = /^#\/p\/([A-Za-z0-9_-]{8,32})/.exec(location.hash)
    if (m) openRemote(m[1]).then(() => history.replaceState(null, '', location.pathname)).catch(() => {})
  }, []) // eslint-disable-line

  const api2 = useMemo(() => ({
    state, active: state.projects.find((p) => p.id === state.activeId) || state.projects[0] || null,
    online, serverUp, syncing, conflict, update, openRemote,
    pending: state.projects.filter((p) => p.dirty).length,
    setActive: (id) => setState((s) => ({ ...s, activeId: id })),
    add: (data) => {
      const id = crypto.randomUUID(), n = state.projects.length + 1
      const p = { id, kode: randKode(), version: 0, dirty: true, localAt: Date.now(), nomor: `${data.jenis === 'Tambah Daya' ? 'TD' : 'PB'}-2026-${String(n).padStart(3, '0')}`,
        status: 'Draft', tanggal: new Date().toISOString().slice(0, 10), points: [], crossings: [], jalur: 'KONSTRUKSI JTM 3 FASA PADA TIANG BETON',
        meta: { noGambar: '', skala: '1 : 500', perihal: data.jenis, digambar: '', diperiksa: '', diketahui: '', disetujui: '' },
        rabOpt: { harga: 'HSS', jenis: 'Total', asal: 'Gudang UP3' }, priceEdits: {}, labelPos: {}, foto: [], ...data }
      setState((s) => ({ ...s, projects: [p, ...s.projects], activeId: id })); schedule(id); return id
    },
    addDemo: () => { const p = recompute(demoProject()); setState((s) => ({ ...s, projects: [{ ...p, dirty: true, localAt: Date.now() }, ...s.projects], activeId: p.id })); schedule(p.id) },
    copy: async (id) => {
      const src = stateRef.current.projects.find((p) => p.id === id); if (!src) return
      if (src.version && navigator.onLine && !src.dirty) { try { const d = await api.post(`/api/proyek/${src.kode}/salin`); await openRemote(d.kode); return } catch { /* turun ke salin lokal */ } }
      const nid = crypto.randomUUID()
      const c = { ...JSON.parse(JSON.stringify(src)), id: nid, kode: randKode(), version: 0, dirty: true, localAt: Date.now(), nomor: (src.nomor || '') + '-SALIN', status: 'Draft', nama: src.nama + ' (salinan)', points: src.points.map((p) => ({ ...p, id: crypto.randomUUID() })), foto: [] }
      setState((s) => ({ ...s, activeId: nid, projects: [c, ...s.projects] })); schedule(nid)
    },
    remove: async (id) => {
      const p = stateRef.current.projects.find((x) => x.id === id)
      if (p?.version && navigator.onLine) await api.del(`/api/proyek/${p.kode}`).catch(() => {})
      setState((s) => { const rest = s.projects.filter((x) => x.id !== id); return { ...s, projects: rest, activeId: s.activeId === id ? rest[0]?.id || null : s.activeId } })
    },
    // foto per pekerjaan: simpan di perangkat, unggah ke server saat online
    addFoto: async (id, file) => {
      const p = stateRef.current.projects.find((x) => x.id === id); if (!p) return
      const fid = crypto.randomUUID(), src = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(file) })
      patch(id, (x) => ({ ...x, foto: [...(x.foto || []), { id: fid, src, pending: true }] }))
      if (navigator.onLine && p.version) {
        try { await api.post(`/api/proyek/${p.kode}/foto`, file, { headers: { 'Content-Type': file.type || 'image/jpeg', 'x-foto-id': fid }, timeout: 30000 }); patch(id, (x) => ({ ...x, foto: x.foto.map((f) => (f.id === fid ? { id: fid, src: `/api/foto/${fid}` } : f)) })) } catch { /* tetap pending */ }
      }
    },
    resolve: async (pakai) => {
      const c = conflict; if (!c) return
      setConflict(null)
      if (pakai === 'server') { const doc = await pull(c.server.kode); patch(c.id, () => doc) }
      else { patch(c.id, (x) => ({ ...x, version: c.server.version, dirty: true, localAt: Date.now() })); setTimeout(() => push(c.id, true), 50) }
    },
    reset: () => setState({ projects: [], activeId: null }),
  }), [state, online, serverUp, syncing, conflict, update, openRemote, push, schedule, pull, patch])
  return <Ctx.Provider value={api2}>{children}</Ctx.Provider>
}
export const useApp = () => useContext(Ctx)
