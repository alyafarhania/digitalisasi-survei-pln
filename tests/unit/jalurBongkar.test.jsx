import { beforeEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { OFF_B, BOX_W, boxRows, buatSkema, ringkasPasang } from '../../src/lib/skema.jsx'
import { GambarSvg, JALUR_LEGEND } from '../../src/lib/gambarSvg.jsx'
import { svgToDrawing } from '../../src/lib/svgToXlsx.js'
import { geserBongkarLat } from '../../src/components/MapView.jsx'
import { C_BARU, C_BONGKAR } from '../../src/lib/symbols.jsx'
import { loadMaster } from '../../src/lib/konstruksi.js'
import { recompute } from '../../src/store.jsx'
import { demoProject } from '../../src/lib/seed.js'
import { hitungRab } from '../../src/lib/shared/rab.js'

beforeEach(async () => { await loadMaster() })

// jalur ungu: titik sendiri pada koordinat yang sama dengan jalur merah (tiang lama yang diganti)
const denganBongkar = () => {
  const d = demoProject()
  const b = d.points.map((x, i) => ({ id: `b${i}`, lat: x.lat, lng: x.lng, nomor: `B${i + 1}`, jenisTiang: 'Tiang Beton 12M-350 daN+E', konduktor: 'AAAC 70 mm²', kondisi: 'Bongkar', konsBongkar: i === 0 ? 'CC1' : '' }))
  return recompute({ ...d, pointsBongkar: b })
}

describe('jalur pembongkaran (ungu): data', () => {
  it('rantai titik terpisah dari jalur merah; sudut dihitung, kode konstruksi tidak', () => {
    const p = denganBongkar()
    expect(p.pointsBongkar).toHaveLength(p.points.length)
    p.pointsBongkar.forEach((x) => { expect(x.sudut).toBeTypeOf('number'); expect(x.kode).toBeUndefined() })
    expect(p.pointsBongkar.map((x) => x.id)).not.toEqual(p.points.map((x) => x.id))
  })
  it('project lama tanpa pointsBongkar tetap jalan', () => {
    const p = recompute(demoProject())
    expect(p.pointsBongkar).toBeUndefined()
    expect(buatSkema(p).ptsB).toEqual([])
  })
  it('RAB pembongkaran menghitung konstruksi bongkar dari kedua jalur', () => {
    const ctx = { getKons: (k) => (k === 'CC1' ? { items: [], bongkar: { u: 'Upah Bongkar CC1', s: 'Unit', hss: 500, khs: 500, gol: 'JASA' } } : null), tiang: {}, konduktor: {}, peralatan: {} }
    const base = { jalur: 'J', rabOpt: { harga: 'HSS', jenis: 'Total', slo: false }, priceEdits: {}, points: [{ lat: -7.7, lng: 110.6, konsBongkar: 'CC1' }] }
    const E = (r) => r.rows.find((x) => x.kelompok === 'E').items[0]
    expect(E(hitungRab(base, ctx)).vol).toBe(1)
    expect(E(hitungRab({ ...base, pointsBongkar: [{ lat: -7.701, lng: 110.6, konsBongkar: 'CC1' }, { lat: -7.702, lng: 110.6, konsBongkar: 'CC1' }] }, ctx))).toMatchObject({ vol: 3, total: 1500 })
  })
})

describe('jalur pembongkaran (ungu): gambar', () => {
  it('isi kotak titik bongkar: tiang yang dibongkar, konstruksi bongkar, peralatan', () => {
    expect(boxRows({ jenisTiang: 'Tiang Beton 12M-350 daN', konsBongkar: 'CC1', kode: 'CC9', peralatan: 'ABSW' }, true).map((r) => r.t)).toEqual(['1C12-350', '1CC1', 'ABSW'])
  })
  it('tabel Bongkar memuat tiang dan konstruksi dari jalur ungu', () => {
    const r = ringkasPasang(denganBongkar())
    expect(r.bongkar[0]).toMatchObject({ kode: 'C12-350', sat: 'Btg' }); expect(r.bongkar.find((x) => x.kode === 'CC1')).toMatchObject({ sat: 'Unit' })
  })
  it('garis ungu sejajar dan tepat OFF_B di atas garis merah; kotak tidak bertumpuk', () => {
    const sk = buatSkema(denganBongkar())
    sk.P.forEach((q, i) => { expect(sk.PB[i].x).toBeCloseTo(q.x); expect(sk.PB[i].y).toBeCloseTo(q.y - OFF_B) })
    const semua = [...sk.box.map((b, i) => ({ ...b, h: sk.boxH(i) })), ...sk.boxB.map((b, i) => ({ ...b, h: sk.boxHB(i) }))]
    for (let i = 0; i < semua.length; i++) for (let j = i + 1; j < semua.length; j++) {
      const a = semua[i], b = semua[j]
      expect(a.x < b.x + BOX_W && a.x + BOX_W > b.x && a.y < b.y + b.h && a.y + a.h > b.y).toBe(false)
    }
  })
  it('legenda memuat kedua jalur beserta warnanya, SVG memuat garis merah dan ungu', () => {
    const p = denganBongkar()
    const svg = renderToStaticMarkup(<GambarSvg p={p} untukFile />)
    expect(JALUR_LEGEND).toEqual([['Jalur Pasang (Merah)', C_BARU], ['Jalur Bongkar (Ungu)', C_BONGKAR]])
    expect(svg).toContain('Jalur Pasang (Merah)'); expect(svg).toContain('Jalur Bongkar (Ungu)')
    expect(svg).toContain(`stroke="${C_BONGKAR}"`); expect(svg).toContain(`stroke="${C_BARU}"`)
  })
  it('Excel: jalur ungu menjadi bentuk bernama yang bisa diedit', () => {
    const r = svgToDrawing(renderToStaticMarkup(<GambarSvg p={denganBongkar()} untukFile />))
    expect(r.xml).toContain('name="Jalur pembongkaran (ungu)"'); expect(r.xml).toContain('name="Titik bongkar B1"')
    expect(r.xml).toContain('name="Legenda Jalur Bongkar (Ungu)"'); expect(r.xml).toContain('9B30D9')
  })
})

describe('jalur pembongkaran (ungu): peta', () => {
  it('geser ke utara, mengecil saat zoom out, tetap positif', () => {
    const a = geserBongkarLat(18, -7.7), b = geserBongkarLat(15, -7.7)
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(0)
    expect(geserBongkarLat(17, -7.7)).toBeGreaterThan(geserBongkarLat(18, -7.7)) // meter per piksel lebih besar di zoom kecil, tetapi px tetap
  })
})
