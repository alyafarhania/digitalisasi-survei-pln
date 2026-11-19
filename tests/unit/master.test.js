import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { MASTER, getKons, kodeList, loadMaster, materialMap, pickKode } from '../../src/lib/konstruksi.js'

const raw = JSON.parse(readFileSync('public/mock/master.json', 'utf8'))
const JTM3 = 'KONSTRUKSI JTM 3 FASA PADA TIANG BETON'

describe('master.json (hasil impor Excel)', () => {
  it('berisi semua bagian', () => { for (const k of ['konstruksi', 'tiang', 'peralatan', 'konduktor', 'tarif']) expect(raw[k].length).toBeGreaterThan(0) })
  it('setiap konstruksi punya grup, kode, dan item', () => { for (const k of raw.konstruksi) { expect(k.grup).toBeTruthy(); expect(k.kode).toBeTruthy(); expect(Array.isArray(k.items)).toBe(true) } })
  it('item konstruksi punya uraian, satuan, volume', () => { const i = raw.konstruksi.find((k) => k.kode === 'CC1').items; expect(i.length).toBeGreaterThan(3); for (const x of i) expect(typeof x.u).toBe('string') })
  it('kode CC1 membaca rentang sudut 0–10° dari nama upah', () => { const k = raw.konstruksi.find((x) => x.grup === JTM3 && x.kode === 'CC1'); expect(k).toMatchObject({ smin: 0, smax: 10 }) })
  it('tiang hanya baris "Tiang…"', () => { for (const t of raw.tiang) expect(t.nama).toMatch(/^tiang/i) })
  it('konduktor: JTM/JTR dan 1 atau 3 fasa', () => { for (const k of raw.konduktor) { expect(['JTM', 'JTR']).toContain(k.kelompok_garis); expect([1, 3]).toContain(k.fasa) } })
  it('peralatan dari kelompok yang benar dan bukan jasa', () => { for (const p of raw.peralatan) { expect(['TRAFO DISTRIBUSI', 'SWITCH', 'LIGHTNING ARESTER', 'PEMBATAS & PROTEKSI']).toContain(p.kelompok); expect(p.gol).not.toBe('JASA') } })
  it('sebagian besar harga HSS terisi', () => { const all = raw.konstruksi.flatMap((k) => k.items); expect(all.filter((i) => i.hss > 0).length / all.length).toBeGreaterThan(0.5) })
  it('tarif standar', () => expect(raw.tarif).toEqual(expect.arrayContaining(['R1', 'B1', 'I1'])))
})
describe('konstruksi.js (klien)', () => {
  it('loadMaster mengisi MASTER dari /mock/master.json', async () => { const r = await loadMaster(); expect(r.ok).toBe(true); expect(MASTER.konstruksi.length).toBe(raw.konstruksi.length) })
  it('menyimpan salinan di perangkat untuk mode offline', async () => { await loadMaster(); expect(localStorage.getItem('pln-master-v2')).toBeTruthy() })
  it('server tak terjangkau: memakai salinan perangkat', async () => {
    await loadMaster(); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const r = await loadMaster(); expect(r).toMatchObject({ ok: true, fresh: false })
  })
  it('pickKode memilih kode dari sudut belokan', async () => {
    await loadMaster()
    expect(pickKode(0, JTM3)).toBe('CC1'); expect(pickKode(10, JTM3)).toBe('CC1'); expect(pickKode(15, JTM3)).toBe('CC2'); expect(pickKode(45, JTM3)).toBe('CC3')
  })
  it('sudut di celah rentang kode (20–30°) belum punya kode otomatis', async () => { await loadMaster(); expect(pickKode(25, JTM3)).toBeNull() })
  it('sudut di luar rentang terbesar (>60°) tidak punya kode otomatis', async () => { await loadMaster(); expect(pickKode(75, JTM3)).toBeNull() })
  it('kode khusus (mengandung tanda petik/strip) tidak dipilih otomatis', async () => { await loadMaster(); for (const a of [0, 15, 45]) expect(pickKode(a, JTM3)).not.toMatch(/['\-]/) })
  it('grup tidak dikenal = null', async () => { await loadMaster(); expect(pickKode(0, 'GRUP X')).toBeNull() })
  it('kodeList & getKons', async () => { await loadMaster(); expect(kodeList(JTM3)).toContain('CC1'); expect(getKons('CC1', JTM3).items.length).toBeGreaterThan(0) })
  it('materialMap memuat tiang, peralatan, konduktor menurut nama', async () => { await loadMaster(); const m = materialMap(); expect(m[raw.tiang[0].nama]).toBeTruthy(); expect(m[raw.konduktor[0].nama]).toBeTruthy() })
})
