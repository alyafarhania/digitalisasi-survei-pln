import { beforeEach, describe, expect, it } from 'vitest'
import { STEPS, manualKurang, stepGuide, stepIndex, stepStatus } from '../../src/lib/steps.js'
import { loadMaster } from '../../src/lib/konstruksi.js'
import { recompute } from '../../src/store.jsx'
import { demoProject } from '../../src/lib/seed.js'

beforeEach(async () => { await loadMaster() })
const lengkap = () => {
  const p = recompute(demoProject())
  return { ...p, meta: { ...p.meta, noGambar: '001/PLN', digambar: 'Agus' }, foto: [{ id: 'f1' }], guide: { 'peta:selesai': true, 'gambar:cek': true, 'rab:opsi': true, 'ekspor:unduh': true } }
}
const keys = STEPS.map((s) => s.key)

describe('daftar langkah', () => {
  it('lima langkah berurutan', () => expect(keys).toEqual(['data', 'peta', 'gambar', 'rab', 'ekspor']))
  it('stepIndex', () => { expect(stepIndex('rab')).toBe(3); expect(stepIndex('project')).toBe(-1) })
})
describe('stepStatus', () => {
  it('tanpa project: hanya langkah 1 yang terbuka', () => { const s = stepStatus(null); expect(s.data.ready).toBe(true); for (const k of keys.slice(1)) expect(s[k].ready).toBe(false) })
  it('project lengkap: semua langkah selesai dan terbuka', () => { const s = stepStatus(lengkap()); for (const k of keys) { expect(s[k].done, k).toBe(true); expect(s[k].ready, k).toBe(true) } })
  it('data belum lengkap: langkah berikutnya terkunci', () => { const s = stepStatus({ ...lengkap(), nama: '' }); expect(s.data.done).toBe(false); expect(s.data.todo[0]).toMatch(/nama pelanggan/); for (const k of keys.slice(1)) expect(s[k].ready).toBe(false) })
  it('peta butuh minimal 2 titik', () => { const p = lengkap(); const s = stepStatus({ ...p, points: p.points.slice(0, 1) }); expect(s.peta.done).toBe(false); expect(s.peta.todo[0]).toMatch(/minimal 2 titik/); expect(s.gambar.ready).toBe(false) })
  it('peta butuh dicentang "Selesai" (butir manual wajib)', () => { const s = stepStatus({ ...lengkap(), guide: {} }); expect(s.peta.done).toBe(false); expect(s.peta.todo[0]).toMatch(/^Centang:/); expect(s.gambar.ready).toBe(false) })
  it('gambar butuh No. Gambar dan nama penggambar', () => { const p = lengkap(); const s = stepStatus({ ...p, meta: { ...p.meta, noGambar: '', digambar: '' } }); expect(s.gambar.done).toBe(false); expect(s.gambar.todo[0]).toMatch(/No\. Gambar.*penggambar/) })
  it('KHS dengan harga kosong: RAB dan Ekspor belum lengkap', () => { const p = lengkap(); const s = stepStatus({ ...p, rabOpt: { ...p.rabOpt, harga: 'KHS' } }); expect(s.rab.done).toBe(false); expect(s.rab.todo[0]).toMatch(/harga masih kosong/); expect(s.ekspor.ready).toBe(false) })
  it('ekspor butuh foto lokasi', () => { const s = stepStatus({ ...lengkap(), foto: [] }); expect(s.ekspor.done).toBe(false); expect(s.ekspor.todo.join()).toMatch(/foto/i) })
  it('ekspor butuh Unduh Excel dicentang', () => { const p = lengkap(); const s = stepStatus({ ...p, guide: { ...p.guide, 'ekspor:unduh': false } }); expect(s.ekspor.done).toBe(false) })
  it('berurutan: langkah setelah yang belum lengkap selalu terkunci', () => { const s = stepStatus({ ...lengkap(), guide: {} }); expect(s.peta.ready).toBe(true); expect(['gambar', 'rab', 'ekspor'].every((k) => !s[k].ready)).toBe(true); expect(s.gambar.todo[0]).toMatch(/sebelumnya/) })
  it('belokan tajam memberi peringatan di langkah peta', () => { const p = lengkap(); const pts = p.points.map((x, i) => (i === 1 ? { ...x, sudut: 120 } : x)); expect(stepStatus({ ...p, points: pts }).peta.warn).toMatch(/belokan tajam/) })
})
describe('stepGuide (panduan)', () => {
  it('tiap langkah punya judul, butir, dan tips', () => { for (const k of keys) { const g = stepGuide(k, null); expect(g.title).toBeTruthy(); expect(g.items.length).toBeGreaterThan(2); expect(g.tip).toBeTruthy() } })
  it('butir punya id unik per langkah', () => { for (const k of keys) { const ids = stepGuide(k, null).items.map((i) => i.id); expect(new Set(ids).size).toBe(ids.length) } })
  it('butir otomatis mengikuti data, butir manual mengikuti project.guide', () => {
    const g = stepGuide('peta', lengkap()), by = (id) => g.items.find((i) => i.id === id)
    expect(by('titik')).toMatchObject({ auto: true, done: true }); expect(by('selesai')).toMatchObject({ auto: false, done: true })
    expect(stepGuide('peta', { ...lengkap(), guide: {} }).items.find((i) => i.id === 'selesai').done).toBe(false)
  })
  it('manualKurang hanya butir manual WAJIB yang belum dicentang', () => {
    const p = { ...lengkap(), guide: {} }
    expect(manualKurang('peta', p).map((i) => i.id)).toEqual(['selesai']) // "mulai" & "silang" opsional
    expect(manualKurang('gambar', p).map((i) => i.id)).toEqual(['cek']); expect(manualKurang('data', p)).toEqual([])
  })
  it('butir opsional tidak menghalangi', () => expect(stepStatus(lengkap()).peta.done).toBe(true))
})
