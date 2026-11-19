import { describe, expect, it, vi } from 'vitest'
import { mockCall } from '../../src/lib/mockServer.js'
import { fotoDel, fotoGet, fotoPut } from '../../src/lib/fotoStore.js'

const K = 'abcdefgh12', doc = (over = {}) => ({ id: crypto.randomUUID(), kode: K, nomor: 'PB-1', nama: 'Budi', jenis: 'Pasang Baru', lokasi: 'Klaten', daya: 1300, status: 'Draft', points: [{ id: 'a' }, { id: 'b' }], baseVersion: 0, ...over })
const put = (d, q = '') => mockCall('PUT', `/api/proyek/${d.kode}${q}`, d)
const code = async (fn) => { try { await fn(); return null } catch (e) { return e } }

describe('mock API: dasar', () => {
  it('health', async () => expect(await mockCall('GET', '/api/health')).toEqual({ ok: true }))
  it('master dikirim lengkap dengan waktu', async () => { const m = await mockCall('GET', '/api/master'); expect(m.konstruksi.length).toBeGreaterThan(100); expect(m.at).toBeTruthy() })
  it('rute tidak dikenal = 404', async () => expect((await code(() => mockCall('GET', '/api/tidak-ada'))).status).toBe(404))
  it('offline melempar TypeError (seperti fetch)', async () => { vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false); expect(await code(() => mockCall('GET', '/api/health'))).toBeInstanceOf(TypeError) })
})
describe('mock API: simpan project (versi & konflik 409)', () => {
  it('PUT baru -> versi 1', async () => { const r = await put(doc()); expect(r.version).toBe(1); expect(r.kode).toBe(K) })
  it('PUT dengan versi terbaru -> versi bertambah', async () => { await put(doc()); expect((await put(doc({ baseVersion: 1, nama: 'Baru' }))).version).toBe(2) })
  it('PUT dengan versi usang -> 409 + dokumen server', async () => {
    await put(doc()); await put(doc({ baseVersion: 1 }))
    const e = await code(() => put(doc({ baseVersion: 1, nama: 'Konflik' }))); expect(e.status).toBe(409); expect(e.data.conflict).toBe(true); expect(e.data.server.version).toBe(2)
  })
  it('?force=1 menimpa walau versi beda', async () => { await put(doc()); await put(doc({ baseVersion: 1 })); expect((await put(doc({ baseVersion: 0, nama: 'Paksa' }), '?force=1')).nama).toBe('Paksa') })
  it('baseVersion tidak ikut tersimpan di dokumen', async () => { await put(doc()); expect('baseVersion' in (await mockCall('GET', `/api/proyek/${K}`))).toBe(false) })
  it('GET project', async () => { await put(doc()); expect((await mockCall('GET', `/api/proyek/${K}`)).nama).toBe('Budi') })
  it('GET tidak ada = 404', async () => expect((await code(() => mockCall('GET', '/api/proyek/zzzzzzzz99'))).status).toBe(404))
  it('bidang audit ikut tersimpan', async () => { await put(doc({ createdBy: { id: 'u1', name: 'A' }, audit: [{ id: '1', action: 'created' }] })); const d = await mockCall('GET', `/api/proyek/${K}`); expect(d.createdBy.name).toBe('A'); expect(d.audit).toHaveLength(1) })
})
describe('mock API: daftar & cari', () => {
  const seed = async () => { for (const [i, n] of ['Andi', 'Budi', 'Citra'].entries()) await put(doc({ kode: `kode000${i}xx`, nama: n, nomor: `PB-${i}`, lokasi: i === 2 ? 'Pedan' : 'Klaten' })) }
  it('mengembalikan ringkasan + jumlah titik', async () => { await seed(); const l = await mockCall('GET', '/api/proyek'); expect(l).toHaveLength(3); expect(l[0]).toMatchObject({ titik: 2 }); expect('points' in l[0]).toBe(false) })
  it('cari menurut nama, nomor, lokasi (tanpa peduli huruf besar)', async () => { await seed(); expect((await mockCall('GET', '/api/proyek?q=BUDI'))).toHaveLength(1); expect((await mockCall('GET', '/api/proyek?q=pb-2'))).toHaveLength(1); expect((await mockCall('GET', '/api/proyek?q=pedan'))).toHaveLength(1) })
  it('cari menurut kode project persis', async () => { await seed(); expect((await mockCall('GET', '/api/proyek?q=kode0001xx'))).toHaveLength(1) })
  it('diurutkan terbaru dulu', async () => { await seed(); await new Promise((r) => setTimeout(r, 5)); await put(doc({ kode: 'kode0000xx', baseVersion: 1, nama: 'Andi 2' })); expect((await mockCall('GET', '/api/proyek'))[0].nama).toBe('Andi 2') })
})
describe('mock API: hapus & salin', () => {
  it('hapus lunak: hilang dari daftar dan GET', async () => { await put(doc()); await mockCall('DELETE', `/api/proyek/${K}`); expect(await mockCall('GET', '/api/proyek')).toHaveLength(0); expect((await code(() => mockCall('GET', `/api/proyek/${K}`))).status).toBe(404) })
  it('salin: kode baru, Draft, pembuat dari permintaan, audit "copied"', async () => {
    await put(doc({ status: 'Selesai', finalizedBy: { name: 'X' }, guide: { 'peta:selesai': true } }))
    const by = { id: 'u2', name: 'Siti', role: 'surveyor' }, c = await mockCall('POST', `/api/proyek/${K}/salin`, { by, at: '2026-11-19T00:00:00.000Z' })
    expect(c.kode).not.toBe(K); expect(c).toMatchObject({ status: 'Draft', nama: 'Budi (salinan)', nomor: 'PB-1-SALIN', createdBy: by, guide: {} })
    expect(c.finalizedBy).toBeUndefined(); expect(c.audit[0]).toMatchObject({ action: 'copied', by }); expect(c.points.map((p) => p.id)).not.toContain('a')
  })
  it('salin project yang tidak ada = 404', async () => expect((await code(() => mockCall('POST', '/api/proyek/zzzzzzzz99/salin', {}))).status).toBe(404))
})
describe('mock API: foto', () => {
  it('daftar kosong lalu terisi setelah unggah, hapus menghilangkan', async () => {
    await put(doc()); expect(await mockCall('GET', `/api/proyek/${K}/foto`)).toEqual([])
    const blob = new Blob(['x'], { type: 'image/jpeg' }); await mockCall('POST', `/api/proyek/${K}/foto`, blob, { headers: { 'x-foto-id': 'f1', 'x-foto-meta': JSON.stringify({ by: { name: 'A' }, at: '2026-01-01T00:00:00Z', name: 'a.jpg' }) } })
    expect(await mockCall('GET', `/api/proyek/${K}/foto`)).toEqual([{ id: 'f1', by: { name: 'A' }, at: '2026-01-01T00:00:00Z', name: 'a.jpg' }])
    expect(await fotoGet('f1')).toBeTruthy()
    await mockCall('DELETE', '/api/foto/f1'); expect(await mockCall('GET', `/api/proyek/${K}/foto`)).toEqual([]); expect(await fotoGet('f1')).toBeFalsy()
  })
  it('unggah id yang sama dua kali tidak menggandakan', async () => { const h = { headers: { 'x-foto-id': 'dup' } }; await mockCall('POST', `/api/proyek/${K}/foto`, new Blob(['1']), h); await mockCall('POST', `/api/proyek/${K}/foto`, new Blob(['2']), h); expect(await mockCall('GET', `/api/proyek/${K}/foto`)).toHaveLength(1) })
})
describe('fotoStore (IndexedDB)', () => {
  it('put/get/del', async () => { await fotoPut('k', new Blob(['abc'])); expect(await fotoGet('k')).toBeTruthy(); await fotoDel('k'); expect(await fotoGet('k')).toBeFalsy() })
  it('id tidak ada = falsy', async () => expect(await fotoGet('tidak-ada')).toBeFalsy())
})
