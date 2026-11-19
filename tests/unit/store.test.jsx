import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AuthProvider } from '../../src/lib/authContext.jsx'
import { Provider, useApp } from '../../src/store.jsx'
import { MOCK_USERS, publicUser, writeSession } from '../../src/lib/auth.js'
import { loadMaster } from '../../src/lib/konstruksi.js'

const as = (id) => writeSession(publicUser(MOCK_USERS.find((u) => u.id === id)))
const wrapper = ({ children }) => <AuthProvider><Provider>{children}</Provider></AuthProvider>
async function boot(userId) {
  as(userId); await loadMaster()
  const h = renderHook(() => useApp(), { wrapper }); await waitFor(() => expect(h.result.current.user?.id).toBe(userId)); return h
}
const data = { nama: 'Budi', jenis: 'Pasang Baru', lokasi: 'Klaten', daya: 1300, tarif: 'R1' }
const sel = (h, kode) => h.result.current.state.projects.find((p) => p.kode === kode)
const seedDb = (over = {}) => {
  const p = { id: crypto.randomUUID(), kode: 'abcdefgh12', nomor: 'PB-1', nama: 'Lama', jenis: 'Pasang Baru', status: 'Draft', points: [], crossings: [], meta: {}, rabOpt: {}, priceEdits: {}, labelPos: {}, foto: [], guide: {}, version: 1, dirty: false, createdBy: { id: 'u-surveyor', name: 'Agus Santoso', role: 'surveyor' }, createdAt: '2026-01-01T00:00:00.000Z', audit: [], ...over }
  localStorage.setItem('pln-survey-v2', JSON.stringify({ projects: [p], activeId: p.id })); return p
}

describe('store: membuat project + audit', () => {
  it('surveyor membuat project: pembuat, waktu, audit "created", terakhir diubah', async () => {
    const h = await boot('u-surveyor'); let kode
    act(() => { kode = h.result.current.add(data) })
    const p = sel(h, kode)
    expect(p).toMatchObject({ status: 'Draft', createdBy: { id: 'u-surveyor', name: 'Agus Santoso' }, lastEditedBy: { id: 'u-surveyor' } }); expect(p.createdAt).toBeTruthy()
    expect(p.audit).toHaveLength(1); expect(p.audit[0]).toMatchObject({ action: 'created', by: { id: 'u-surveyor' } })
    expect(p.nomor).toMatch(/^PB-2026-001$/); expect(p.rabOpt.slo).toBe(true)
  })
  it('jenis Tambah Daya diberi awalan TD', async () => { const h = await boot('u-surveyor'); let k; act(() => { k = h.result.current.add({ ...data, jenis: 'Tambah Daya' }) }); expect(sel(h, k).nomor).toMatch(/^TD-/) })
  it('manajer tidak boleh membuat project', async () => { const h = await boot('u-manajer'); let k = 'x'; act(() => { k = h.result.current.add(data) }); expect(k).toBeNull(); expect(h.result.current.state.projects).toHaveLength(0) })
  it('project contoh dicatat dibuat oleh pengguna', async () => { const h = await boot('u-surveyor'); let k; act(() => { k = h.result.current.addDemo() }); expect(sel(h, k).audit[0]).toMatchObject({ action: 'created', note: 'Project contoh' }) })
})
describe('store: mengubah project (izin + terakhir diubah)', () => {
  it('pemilik mengubah: data berubah dan "terakhir diubah oleh" tercatat', async () => {
    const h = await boot('u-surveyor'); let k; act(() => { k = h.result.current.add(data) }); const id = sel(h, k).id
    act(() => h.result.current.update(id, { nama: 'Budi Baru' })); const p = sel(h, k)
    expect(p.nama).toBe('Budi Baru'); expect(p.lastEditedBy.id).toBe('u-surveyor'); expect(p.dirty).toBe(true)
  })
  it('titik ditambah: sudut dan kode dihitung ulang otomatis', async () => {
    const h = await boot('u-surveyor'); let k; act(() => { k = h.result.current.add(data) }); const id = sel(h, k).id
    const P = (lat, lng) => ({ id: crypto.randomUUID(), lat, lng })
    act(() => h.result.current.update(id, (p) => ({ ...p, points: [P(-7.7, 110.6), P(-7.7, 110.601), P(-7.7, 110.602)] })))
    expect(sel(h, k).points[1]).toMatchObject({ sudut: 0, kode: 'CC1' })
  })
  it('surveyor lain TIDAK boleh mengubah project orang lain', async () => { seedDb(); const h = await boot('u-surveyor2'); act(() => h.result.current.update(h.result.current.state.projects[0].id, { nama: 'Diubah paksa' })); expect(h.result.current.state.projects[0].nama).toBe('Lama') })
  it('manajer tidak boleh mengubah', async () => { seedDb(); const h = await boot('u-manajer'); act(() => h.result.current.update(h.result.current.state.projects[0].id, { nama: 'X' })); expect(h.result.current.state.projects[0].nama).toBe('Lama') })
  it('perencana boleh mengubah project siapa pun', async () => { seedDb(); const h = await boot('u-perencana'); act(() => h.result.current.update(h.result.current.state.projects[0].id, { nama: 'Diubah perencana' })); expect(h.result.current.state.projects[0]).toMatchObject({ nama: 'Diubah perencana', lastEditedBy: { id: 'u-perencana' } }) })
  it('project Final terkunci, juga untuk admin', async () => { seedDb({ status: 'Selesai' }); const h = await boot('u-admin'); act(() => h.result.current.update(h.result.current.state.projects[0].id, { nama: 'X' })); expect(h.result.current.state.projects[0].nama).toBe('Lama') })
  it('centang panduan manual dan penandaan otomatis', async () => {
    const h = await boot('u-surveyor'); let k; act(() => { k = h.result.current.add(data) }); const id = sel(h, k).id
    act(() => h.result.current.toggleGuide(id, 'peta:selesai')); expect(sel(h, k).guide['peta:selesai']).toBe(true)
    act(() => h.result.current.toggleGuide(id, 'peta:selesai')); expect(sel(h, k).guide['peta:selesai']).toBe(false)
    act(() => h.result.current.markGuide(id, 'gambar:png')); act(() => h.result.current.markGuide(id, 'gambar:png')); expect(sel(h, k).guide['gambar:png']).toBe(true)
  })
})
describe('store: finalisasi, buka kembali, hapus, salin (diaudit)', () => {
  it('perencana memfinalisasi: status, pelaku, waktu, dan audit', async () => {
    seedDb(); const h = await boot('u-perencana'); const id = h.result.current.state.projects[0].id; let ok; act(() => { ok = h.result.current.finalize(id) })
    const p = h.result.current.state.projects[0]; expect(ok).toBe(true)
    expect(p).toMatchObject({ status: 'Selesai', finalizedBy: { id: 'u-perencana', name: 'Bagus Prasetyo' } }); expect(p.finalizedAt).toBeTruthy(); expect(p.audit.at(-1)).toMatchObject({ action: 'finalized', by: { id: 'u-perencana' } })
  })
  it('surveyor TIDAK boleh memfinalisasi', async () => { seedDb(); const h = await boot('u-surveyor'); let ok; act(() => { ok = h.result.current.finalize(h.result.current.state.projects[0].id) }); expect(ok).toBe(false); expect(h.result.current.state.projects[0].status).toBe('Draft') })
  it('finalisasi dua kali tidak menggandakan audit', async () => { seedDb(); const h = await boot('u-admin'); const id = h.result.current.state.projects[0].id; act(() => { h.result.current.finalize(id) }); act(() => { h.result.current.finalize(id) }); expect(h.result.current.state.projects[0].audit.filter((a) => a.action === 'finalized')).toHaveLength(1) })
  it('buka kembali: kembali Draft, jejak final dibersihkan, audit "reopened" ditambah', async () => {
    seedDb({ status: 'Selesai', finalizedBy: { id: 'x', name: 'X' }, finalizedAt: '2026-01-02T00:00:00Z', audit: [{ id: '1', action: 'finalized', by: { id: 'x' }, at: '2026-01-02T00:00:00Z' }] })
    const h = await boot('u-perencana'); act(() => { h.result.current.reopen(h.result.current.state.projects[0].id) }); const p = h.result.current.state.projects[0]
    expect(p.status).toBe('Draft'); expect(p.finalizedBy).toBeUndefined(); expect(p.audit.map((a) => a.action)).toEqual(['finalized', 'reopened'])
  })
  it('surveyor tidak boleh membuka kembali', async () => { seedDb({ status: 'Selesai' }); const h = await boot('u-surveyor'); let ok; act(() => { ok = h.result.current.reopen(h.result.current.state.projects[0].id) }); expect(ok).toBe(false) })
  it('admin menghapus project mana pun', async () => { seedDb(); const h = await boot('u-admin'); let ok; await act(async () => { ok = await h.result.current.remove(h.result.current.state.projects[0].id) }); expect(ok).toBe(true); expect(h.result.current.state.projects).toHaveLength(0) })
  it('surveyor menghapus draft sendiri, tapi tidak milik orang lain', async () => {
    seedDb(); const a = await boot('u-surveyor2'); let ok; await act(async () => { ok = await a.result.current.remove(a.result.current.state.projects[0].id) }); expect(ok).toBe(false); expect(a.result.current.state.projects).toHaveLength(1); a.unmount()
    const b = await boot('u-surveyor'); await act(async () => { ok = await b.result.current.remove(b.result.current.state.projects[0].id) }); expect(ok).toBe(true)
  })
  it('perencana tidak boleh menghapus', async () => { seedDb(); const h = await boot('u-perencana'); let ok; await act(async () => { ok = await h.result.current.remove(h.result.current.state.projects[0].id) }); expect(ok).toBe(false) })
  it('salin: pembuat = penyalin, Draft, audit "copied" berisi nomor asal, tanpa jejak final', async () => {
    seedDb({ status: 'Selesai', finalizedBy: { id: 'x', name: 'X' } }); const h = await boot('u-surveyor2')
    await act(async () => { await h.result.current.copy(h.result.current.state.projects[0].id) }); const c = h.result.current.state.projects.find((p) => p.nama.endsWith('(salinan)'))
    expect(c).toMatchObject({ status: 'Draft', createdBy: { id: 'u-surveyor2' }, nomor: 'PB-1-SALIN' }); expect(c.finalizedBy).toBeUndefined(); expect(c.audit[0]).toMatchObject({ action: 'copied', note: 'Salinan dari PB-1' }); expect(c.kode).not.toBe('abcdefgh12')
  })
})
describe('store: simpan & sinkron', () => {
  it('saveNow mengirim ke server tiruan dan menandai tersinkron', async () => {
    const h = await boot('u-surveyor'); let k; act(() => { k = h.result.current.add(data) }); let r
    await act(async () => { r = await h.result.current.saveNow(sel(h, k).id) }); expect(r).toBe('tersinkron'); expect(sel(h, k)).toMatchObject({ version: 1, dirty: false })
  })
  it('offline: tersimpan di perangkat', async () => {
    const { vi } = await import('vitest'); const h = await boot('u-surveyor'); let k; act(() => { k = h.result.current.add(data) }); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    let r; await act(async () => { r = await h.result.current.saveNow(sel(h, k).id) }); expect(r).toBe('di-perangkat'); expect(sel(h, k).dirty).toBe(true)
  })
  it('state tersimpan di localStorage', async () => { const h = await boot('u-surveyor'); act(() => { h.result.current.add(data) }); await waitFor(() => expect(JSON.parse(localStorage.getItem('pln-survey-v2')).projects).toHaveLength(1)) })
})
