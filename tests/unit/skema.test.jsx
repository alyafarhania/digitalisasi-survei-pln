import { beforeEach, describe, expect, it } from 'vitest'
import { RIGHT, HMIN, boxLines, buatSkema, layoutJalur, letakKotak, ringkasPasang, shortKond, tiangCode } from '../../src/lib/skema.jsx'
import { loadMaster } from '../../src/lib/konstruksi.js'
import { recompute } from '../../src/store.jsx'
import { demoProject } from '../../src/lib/seed.js'

beforeEach(async () => { await loadMaster() })
describe('kode tiang & kotak keterangan', () => {
  it('Tiang Beton 12M-350 -> 1C12-350', () => expect(tiangCode({ jenisTiang: 'Tiang Beton 12M-350 daN+E' })).toBe('1C12-350'))
  it('Tiang Besi 11M-200 -> 1S11-200', () => expect(tiangCode({ jenisTiang: 'Tiang Besi 11M-200 daN' })).toBe('1S11-200'))
  it('jenis tiang tak dikenal / kosong -> ""', () => { expect(tiangCode({ jenisTiang: 'Lainnya' })).toBe(''); expect(tiangCode({})).toBe('') })
  it('isi kotak: kode tiang, kode konstruksi berawalan 1, peralatan', () => expect(boxLines({ jenisTiang: 'Tiang Beton 12M-350 daN', kode: 'CC1', peralatan: 'Trafo 3 phasa' })).toEqual(['1C12-350', '1CC1', 'Trafo 3 phasa']))
  it('kode manual didahulukan', () => expect(boxLines({ kode: 'CC1', kodeManual: 'CC3' })).toContain('1CC3'))
  it('nama peralatan panjang dipotong', () => { const l = boxLines({ peralatan: 'Trafo 3 phasa 100 kVA YNyn0' }); expect(l[l.length - 1].length).toBeLessThanOrEqual(15); expect(l[l.length - 1]).toMatch(/…$/) })
  it('shortKond mengambil kata pertama', () => expect(shortKond('AAAC 70 mm²')).toBe('AAAC'))
})
describe('ringkasan Pasang / Bongkar', () => {
  it('menghitung jumlah per kode', () => {
    const p = { points: [{ jenisTiang: 'Tiang Beton 12M-350 daN', kode: 'CC1' }, { jenisTiang: 'Tiang Beton 12M-350 daN', kode: 'CC1', konsBongkar: 'CC2' }, { jenisTiang: 'Tiang Beton 12M-350 daN', kode: 'CC2', konsBongkar: 'CC2' }] }
    const r = ringkasPasang(p)
    expect(r.pasang).toEqual([{ kode: 'C12-350', sat: 'Btg', vol: 3 }, { kode: 'CC1', sat: 'Unit', vol: 2 }, { kode: 'CC2', sat: 'Unit', vol: 1 }]); expect(r.bongkar).toEqual([{ kode: 'CC2', sat: 'Unit', vol: 2 }])
  })
})
describe('tata letak jalur', () => {
  it('tanpa titik', () => expect(layoutJalur([])).toEqual({ P: [], H: HMIN, s: 1 }))
  const pts = recompute(demoProject()).points
  it('utara di atas: lintang lebih besar = y lebih kecil', () => { const { P } = layoutJalur([{ lat: -7.70, lng: 110.6 }, { lat: -7.71, lng: 110.6 }]); expect(P[0].y).toBeLessThan(P[1].y) })
  it('semua titik berada di dalam lembar', () => { const { P, H } = layoutJalur(pts); for (const q of P) { expect(q.x).toBeGreaterThan(0); expect(q.x).toBeLessThan(RIGHT); expect(q.y).toBeGreaterThan(0); expect(q.y).toBeLessThan(H) } })
  it('titik pertama = awal jalur, jumlah titik sama', () => expect(layoutJalur(pts).P).toHaveLength(pts.length))
  it('kotak keterangan tidak saling bertumpuk', () => {
    const P = layoutJalur(pts).P, box = letakKotak(P, () => 52), W = 104
    for (let i = 0; i < box.length; i++) for (let j = i + 1; j < box.length; j++) expect(box[i].x < box[j].x + W && box[i].x + W > box[j].x && box[i].y < box[j].y + 52 && box[i].y + 52 > box[j].y, `${i}-${j}`).toBe(false)
  })
})
describe('buatSkema', () => {
  const p = recompute(demoProject()), sk = buatSkema(p)
  it('menghasilkan posisi, kotak, dan jarak antar titik', () => { expect(sk.P).toHaveLength(p.points.length); expect(sk.box).toHaveLength(p.points.length); expect(sk.sp).toHaveLength(p.points.length - 1); expect(sk.H).toBeGreaterThanOrEqual(905) })
  it('titik yang sangat berdekatan ditandai', () => { const q = { ...p, points: [p.points[0], { ...p.points[0], id: 'x', lat: p.points[0].lat + 0.000001 }, p.points[2]] }; expect(buatSkema(q).dekat.length).toBeGreaterThan(0) })
  it('penyeberangan diletakkan pada segmen terdekat dengan sudut', () => { const pos = sk.place({ lat: p.points[0].lat, lng: p.points[0].lng }); expect(pos).toMatchObject({ x: expect.any(Number), y: expect.any(Number), ang: expect.any(Number) }) })
})
