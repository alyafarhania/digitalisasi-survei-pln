// "Server" tiruan di browser (localStorage + master.json). Dipakai selama backend belum dibuat.
// Meniru kontrak API: PUT dengan baseVersion -> 409 bila beda, kode project, salin, hapus, cari.
import { createRealtime } from './realtime'
import { fotoPut, fotoDel } from './fotoStore'

const KEY = 'pln-mock-server-v1'
const err = (status, msg, data = {}) => Object.assign(new Error(msg), { status, data })
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
const write = (db) => { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* kuota */ } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let rt = null
const bus = () => (rt ||= createRealtime({}))
const newKode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('') + 'x2'

let masterCache = null
async function master() {
  if (!masterCache) {
    const r = await fetch('/mock/master.json')
    if (!r.ok) throw err(503, 'Data master mock tidak ditemukan (jalankan npm run mock:build)')
    masterCache = { ...(await r.json()), at: new Date().toISOString() }
  }
  return masterCache
}

export async function mockCall(method, path, body, opts = {}) {
  await sleep(120) // meniru latensi jaringan agar status "Menyinkronkan…" terlihat
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('offline')
  const url = new URL(path, 'http://x'), p = url.pathname, db = read()
  db.projects ||= {}
  if (p === '/api/health') return { ok: true }
  if (p === '/api/master') return master()

  let m
  if (p === '/api/proyek' && method === 'GET') {
    const q = (url.searchParams.get('q') || '').toLowerCase()
    return Object.values(db.projects).filter((d) => !d.deleted && (`${d.nama} ${d.nomor} ${d.lokasi}`.toLowerCase().includes(q) || d.kode === q))
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)).slice(0, 100)
      .map((d) => ({ kode: d.kode, nomor: d.nomor, nama: d.nama, jenis: d.jenis, lokasi: d.lokasi, tarif: d.tarif, daya: d.daya, status: d.status, version: d.version, updated_at: d.updatedAt, titik: d.points.length }))
  }
  if ((m = p.match(/^\/api\/proyek\/([\w-]+)$/))) {
    const kode = m[1], cur = db.projects[kode]
    if (method === 'GET') { if (!cur || cur.deleted) throw err(404, 'Project tidak ditemukan'); return cur }
    if (method === 'PUT') {
      if (cur && !cur.deleted && !url.searchParams.get('force') && Number(body.baseVersion) !== cur.version) throw err(409, 'Konflik versi', { conflict: true, server: cur })
      const { baseVersion, ...doc } = body
      const saved = { ...doc, kode, version: (cur?.version || 0) + 1, updatedAt: new Date().toISOString(), deleted: false }
      db.projects[kode] = saved; write(db)
      bus().publish({ kode, version: saved.version, from: opts.headers?.['x-client-id'] || null })
      return saved
    }
    if (method === 'DELETE') { if (cur) { cur.deleted = true; cur.audit = [...(cur.audit || []), { id: crypto.randomUUID(), action: 'deleted', by: { id: 'unknown', name: 'Pengguna', role: '' }, at: new Date().toISOString() }]; write(db) } return { ok: true } }
  }
  if ((m = p.match(/^\/api\/proyek\/([\w-]+)\/salin$/)) && method === 'POST') {
    const src = db.projects[m[1]]; if (!src) throw err(404, 'Project tidak ditemukan')
    const kode = newKode(), id = crypto.randomUUID()
    const by = body?.by || { id: 'system', name: 'Sistem', role: 'system' }, at = body?.at || new Date().toISOString()
    db.projects[kode] = { ...structuredClone(src), id, kode, nama: src.nama + ' (salinan)', nomor: (src.nomor || '') + '-SALIN', status: 'Draft', version: 1, updatedAt: at, points: src.points.map((t) => ({ ...t, id: crypto.randomUUID() })), pointsBongkar: (src.pointsBongkar || []).map((t) => ({ ...t, id: crypto.randomUUID() })),
      guide: {}, createdBy: by, createdAt: at, lastEditedBy: by, lastEditedAt: at, finalizedBy: undefined, finalizedAt: undefined,
      audit: [{ id: crypto.randomUUID(), action: 'copied', by, at, note: `Salinan dari ${src.nomor}` }] }
    write(db); return db.projects[kode]
  }
  if ((m = p.match(/^\/api\/proyek\/([\w-]+)\/foto$/))) {
    db.fotos ||= {}
    if (method === 'GET') return db.fotos[m[1]] || []
    const meta = (() => { try { return JSON.parse(opts.headers?.['x-foto-meta'] || '{}') } catch { return {} } })(), id = opts.headers?.['x-foto-id'] || crypto.randomUUID()
    if (body instanceof Blob) await fotoPut(id, body)
    db.fotos[m[1]] = [...(db.fotos[m[1]] || []).filter((f) => f.id !== id), { id, by: meta.by, at: meta.at || new Date().toISOString(), name: meta.name }]; write(db)
    bus().publish({ kode: m[1], foto: true, from: opts.headers?.['x-client-id'] || null })
    return { id }
  }
  if ((m = p.match(/^\/api\/foto\/([\w-]+)$/)) && method === 'DELETE') {
    db.fotos ||= {}; for (const k of Object.keys(db.fotos)) db.fotos[k] = db.fotos[k].filter((f) => f.id !== m[1]); write(db); await fotoDel(m[1]); return { ok: true }
  }
  throw err(404, `Mock: ${method} ${p} belum ada`)
}
