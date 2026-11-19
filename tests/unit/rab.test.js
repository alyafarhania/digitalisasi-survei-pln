import { describe, expect, it } from 'vitest'
import { hitungRab, kolomOf, spans, terbilang } from '../../src/lib/shared/rab.js'
import { rabKosong } from '../../src/lib/rab.js'

const KONS = {
  CC1: { items: [{ u: 'Isolator', s: 'Bh', v: 3, hss: 100, khs: null, gol: 'MDU' }, { u: 'Bolt', s: 'Bh', v: 2, hss: 10, khs: 12, gol: 'HDW' }, { u: 'Upah Pasang CC1', s: 'Unit', v: 1, hss: 1000, khs: 1100, gol: 'JASA' }],
    bongkar: { u: 'Upah Bongkar CC1', s: 'Unit', hss: 500, khs: 550, gol: 'JASA' } },
}
const ctx = {
  getKons: (k) => KONS[k],
  tiang: { 'Tiang A': { sat: 'Btg', hss: 5000, khs: 5200, gol: 'MDU' } }, konduktor: { 'AAAC 70': { sat: 'm', hss: 20, khs: 22, gol: 'MDU' } }, peralatan: { 'Trafo X': { sat: 'Bh', hss: 10000, khs: 11000, gol: 'MDU' } },
}
const P0 = { lat: -7.7, lng: 110.6 }
const proj = (over = {}) => ({
  jalur: 'J', rabOpt: { harga: 'HSS', jenis: 'Total', slo: true }, priceEdits: {},
  points: [{ ...P0, jenisTiang: 'Tiang A', kode: 'CC1', konduktor: 'AAAC 70', panjang: 50, peralatan: 'Trafo X', konsBongkar: 'CC1' }, { lat: P0.lat + 0.001, lng: P0.lng, jenisTiang: 'Tiang A', kode: 'CC1', konduktor: 'AAAC 70', panjang: 50 }], ...over,
})
const item = (r, kel, nama) => r.rows.find((x) => x.kelompok === kel).items.find((i) => i.nama === nama)

describe('hitungRab: kelompok pekerjaan', () => {
  const r = hitungRab(proj(), ctx)
  it('A penanaman tiang = jumlah titik × harga', () => expect(item(r, 'A', 'Tiang A')).toMatchObject({ vol: 2, price: 5000, total: 10000, gol: 'MDU' }))
  it('B konstruksi: volume bahan × jumlah titik berkode sama', () => {
    expect(item(r, 'B', 'Isolator')).toMatchObject({ vol: 6, total: 600, konstruksi: 'CC1', unit: 2 })
    expect(item(r, 'B', 'Bolt')).toMatchObject({ vol: 4, total: 40 }); expect(item(r, 'B', 'Upah Pasang CC1')).toMatchObject({ vol: 2, total: 2000 })
  })
  it('C penghantar = jumlah panjang (m)', () => expect(item(r, 'C', 'AAAC 70')).toMatchObject({ vol: 100, total: 2000 }))
  it('D peralatan per unit', () => expect(item(r, 'D', 'Trafo X')).toMatchObject({ vol: 1, total: 10000 }))
  it('E pembongkaran hanya upah bongkar', () => expect(item(r, 'E', 'Upah Bongkar CC1')).toMatchObject({ vol: 1, total: 500 }))
  it('kelompok D & E tidak muncul bila kosong', () => { const x = hitungRab(proj({ points: proj().points.map((p) => ({ ...p, peralatan: '', konsBongkar: '' })) }), ctx); expect(x.rows.map((k) => k.kelompok)).toEqual(['A', 'B', 'C']) })
})
describe('hitungRab: ringkasan (SLO 2,5%, PPN 11%)', () => {
  it('kolom MDU / Hardware / Jasa', () => { const r = hitungRab(proj(), ctx); expect(r.sub.mdu).toBe(22600); expect(r.sub.hardware).toBe(40) })
  it('SLO = 2,5% dari jumlah, ditambahkan ke jasa', () => { const r = hitungRab(proj(), ctx); expect(r.slo.jumlah).toBeCloseTo(628.5); expect(r.sub.jasa).toBeCloseTo(3128.5) })
  it('PPN 11% dan jumlah total', () => { const r = hitungRab(proj(), ctx); expect(r.pctPpn).toBe(0.11); expect(r.ppn.total).toBeCloseTo(r.sub.total * 0.11); expect(r.grand).toBeCloseTo(28603.035) })
  it('SLO dimatikan: tidak ada baris SLO dan jasa tidak bertambah', () => { const r = hitungRab(proj({ rabOpt: { harga: 'HSS', jenis: 'Total', slo: false } }), ctx); expect(r.slo).toBeNull(); expect(r.sub.jasa).toBe(2500); expect(r.grand).toBeCloseTo(25140 * 1.11) })
  it('SLO tidak ikut bila opsi tidak diisi = diterapkan', () => expect(hitungRab(proj({ rabOpt: { harga: 'HSS', jenis: 'Total' } }), ctx).slo).not.toBeNull())
  it('terbilang disertakan', () => expect(hitungRab(proj(), ctx).terbilang).toMatch(/Rupiah$/))
})
describe('hitungRab: pilihan harga & jenis RAB', () => {
  it('KHS memakai kolom KHS', () => expect(item(hitungRab(proj({ rabOpt: { harga: 'KHS', jenis: 'Total' } }), ctx), 'A', 'Tiang A').price).toBe(5200))
  it('harga KHS kosong dibiarkan kosong (null), bukan 0', () => { const i = item(hitungRab(proj({ rabOpt: { harga: 'KHS', jenis: 'Total' } }), ctx), 'B', 'Isolator'); expect(i.price).toBeNull(); expect(i.total).toBeNull() })
  it('jenis "Non MDU" membuang bahan MDU pada konstruksi', () => { const r = hitungRab(proj({ rabOpt: { harga: 'HSS', jenis: 'Non MDU' } }), ctx); expect(r.rows.find((k) => k.kelompok === 'B').items.some((i) => i.nama === 'Isolator')).toBe(false); expect(item(r, 'B', 'Bolt')).toBeTruthy() })
  it('jenis "MDU" hanya bahan MDU pada konstruksi', () => { const r = hitungRab(proj({ rabOpt: { harga: 'HSS', jenis: 'MDU' } }), ctx); expect(r.rows.find((k) => k.kelompok === 'B').items.map((i) => i.nama)).toEqual(['Isolator']) })
  it('edit harga menimpa harga standar', () => { const r = hitungRab(proj({ priceEdits: { 'Tiang A': '6000' } }), ctx); expect(item(r, 'A', 'Tiang A')).toMatchObject({ price: 6000, total: 12000 }) })
  it('edit harga mengisi harga yang kosong', () => { const r = hitungRab(proj({ rabOpt: { harga: 'KHS', jenis: 'Total' }, priceEdits: { Isolator: '150' } }), ctx); expect(item(r, 'B', 'Isolator')).toMatchObject({ price: 150, total: 900 }) })
  it('edit kosong ("") diabaikan', () => expect(item(hitungRab(proj({ priceEdits: { 'Tiang A': '' } }), ctx), 'A', 'Tiang A').price).toBe(5000))
  it('kode konstruksi manual menggantikan kode otomatis', () => { const pts = proj().points.map((p) => ({ ...p, kode: 'ZZ', kodeManual: 'CC1' })); expect(item(hitungRab(proj({ points: pts }), ctx), 'B', 'Isolator').vol).toBe(6) })
  it('kode tidak dikenal dilewati', () => expect(hitungRab(proj({ points: proj().points.map((p) => ({ ...p, kode: 'TIDAKADA' })) }), ctx).rows.find((k) => k.kelompok === 'B').items).toEqual([]))
})
describe('hitungRab: penghantar bila panjang tidak diisi', () => {
  it('memakai jarak antar titik dari peta', () => { const pts = proj().points.map((p) => ({ ...p, panjang: '' })); const r = hitungRab(proj({ points: pts }), ctx); expect(item(r, 'C', 'AAAC 70').vol).toBe(spans(pts)[0]) })
  it('tanpa jenis konduktor dipilih: default AAAC 70 mm² sepanjang jalur', () => { const pts = proj().points.map((p) => ({ ...p, konduktor: '' })); expect(hitungRab(proj({ points: pts }), { ...ctx, konduktor: {} }).rows.find((k) => k.kelompok === 'C').items[0].nama).toBe('AAAC 70 mm²') })
})
describe('rabKosong (penguncian ekspor, PRD F6)', () => {
  it('lengkap = tidak ada yang kosong', () => expect(rabKosong(hitungRab(proj(), ctx))).toEqual([]))
  it('menandai item KHS Rp0/kosong', () => { const k = rabKosong(hitungRab(proj({ rabOpt: { harga: 'KHS', jenis: 'Total' } }), ctx)); expect(k).toEqual([{ kelompok: 'B', nama: 'Isolator' }]) })
  it('hilang setelah harga diisi', () => expect(rabKosong(hitungRab(proj({ rabOpt: { harga: 'KHS', jenis: 'Total' }, priceEdits: { Isolator: '1' } }), ctx))).toEqual([]))
})
describe('kolomOf & spans', () => {
  it('golongan -> kolom', () => { expect(kolomOf('MDU')).toBe('mdu'); expect(kolomOf('MDU-KD')).toBe('mdu'); expect(kolomOf('JASA')).toBe('jasa'); expect(kolomOf('HDW')).toBe('hardware'); expect(kolomOf('NON MDU KHS')).toBe('hardware') })
  it('spans = jarak antar titik berurutan (dibulatkan)', () => { expect(spans([P0, { lat: P0.lat + 0.001, lng: P0.lng }])).toEqual([111]); expect(spans([P0])).toEqual([]) })
})
describe('terbilang', () => {
  it.each([[0, 'Nol Rupiah'], [11, 'Sebelas Rupiah'], [25, 'Dua Puluh Lima Rupiah'], [100, 'Seratus Rupiah'], [1500, 'Seribu Lima Ratus Rupiah'], [2000, 'Dua Ribu Rupiah'], [1250000, 'Satu Juta Dua Ratus Lima Puluh Ribu Rupiah'], [113907805, 'Seratus Tiga Belas Juta Sembilan Ratus Tujuh Ribu Delapan Ratus Lima Rupiah']])('%i', (n, t) => expect(terbilang(n)).toBe(t))
})
