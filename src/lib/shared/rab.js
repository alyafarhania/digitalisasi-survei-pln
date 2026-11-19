import { dist } from './geo.js'

const isMDU = (g) => g === 'MDU' || g === 'MDU-KD'
export const kolomOf = (g) => (isMDU(g) ? 'mdu' : g === 'JASA' ? 'jasa' : 'hardware')
export function spans(points) { return points.slice(1).map((p, i) => Math.round(dist(points[i], p))) }

/* Hitung RAB dari dokumen project.
   ctx = { getKons(kode, jalur) -> {items:[{u,s,v,hss,khs,gol}]}, tiang: {nama:{sat,hss,khs}}, konduktor: {nama:{sat,hss,khs}} }
   Harga KHS kosong dibiarkan kosong (PRD). */
export function hitungRab(project, ctx) {
  const { points = [], rabOpt = {}, priceEdits = {}, jalur } = project
  const harga = rabOpt.harga || 'HSS', jenis = rabOpt.jenis || 'Total'
  const pick = (it, key) => {
    if (priceEdits[key] != null && priceEdits[key] !== '') return Number(priceEdits[key])
    const v = harga === 'HSS' ? it.hss : it.khs
    return v == null ? null : Number(v)
  }
  const pass = (gol) => (jenis === 'Total' ? true : jenis === 'Non MDU' ? !isMDU(gol) : isMDU(gol))
  const rows = []

  const tiangCount = {}
  points.forEach((p) => p.jenisTiang && (tiangCount[p.jenisTiang] = (tiangCount[p.jenisTiang] || 0) + 1))
  rows.push({ kelompok: 'A', judul: 'PEKERJAAN PENANAMAN TIANG', items: Object.entries(tiangCount).map(([nama, vol]) => {
    const m = ctx.tiang[nama] || { sat: 'Btg' }, price = pick(m, nama)
    return { nama, sat: m.sat || 'Btg', vol, price, total: price == null ? null : price * vol, gol: m.gol || 'MDU' }
  }) })

  const kCount = {}
  points.forEach((p) => { if (p.kode || p.kodeManual) { const k = p.kodeManual || p.kode; kCount[k] = (kCount[k] || 0) + 1 } })
  const B = []
  Object.entries(kCount).forEach(([kode, n]) => {
    const k = ctx.getKons(kode, jalur); if (!k) return
    k.items.forEach((it) => {
      if (!pass(it.gol)) return
      const vol = (Number(it.v) || 0) * n, price = pick(it, it.u)
      B.push({ konstruksi: kode, unit: n, nama: it.u, sat: it.s, vol, price, total: price == null ? null : price * vol, gol: it.gol })
    })
  })
  rows.push({ kelompok: 'B', judul: 'PEKERJAAN PEMASANGAN KONSTRUKSI', items: B })

  const sp = spans(points), total = sp.reduce((a, b) => a + b, 0), kond = {}
  points.forEach((p, i) => { if (p.konduktor) kond[p.konduktor] = (kond[p.konduktor] || 0) + (Number(p.panjang) || (i > 0 ? sp[i - 1] : 0)) })
  if (!Object.keys(kond).length && total && points.length > 1) kond['AAAC 70 mm²'] = total
  rows.push({ kelompok: 'C', judul: 'PEKERJAAN PENARIKAN PENGHANTAR', items: Object.entries(kond).map(([nama, vol]) => {
    const m = ctx.konduktor[nama] || { sat: 'm' }, price = pick(m, nama)
    return { nama, sat: m.sat || 'm', vol, price, total: price == null ? null : price * vol, gol: m.gol || 'MDU' }
  }) })

  // D. peralatan (trafo, ABSW, FCO, dst.) — material per unit
  const pc = {}
  points.forEach((p) => p.peralatan && (pc[p.peralatan] = (pc[p.peralatan] || 0) + 1))
  const D = Object.entries(pc).map(([nama, vol]) => {
    const m = (ctx.peralatan || {})[nama] || { sat: 'Bh' }, price = pick(m, nama)
    return { nama, sat: m.sat || 'Bh', vol, price, total: price == null ? null : price * vol, gol: m.gol || 'MDU' }
  })
  if (D.length) rows.push({ kelompok: 'D', judul: 'PEKERJAAN PEMASANGAN PERALATAN', items: D })

  // E. pembongkaran — biaya hanya upah bongkar (konstruksi lama tidak ada biaya)
  const bc = {}
  points.forEach((p) => p.konsBongkar && (bc[p.konsBongkar] = (bc[p.konsBongkar] || 0) + 1))
  const E = []
  Object.entries(bc).forEach(([kode, n]) => {
    const b = ctx.getKons(kode, jalur)?.bongkar; if (!b) return
    const price = pick(b, b.u)
    E.push({ konstruksi: kode, nama: b.u, sat: b.s, vol: n, price, total: price == null ? null : price * n, gol: b.gol })
  })
  if (E.length) rows.push({ kelompok: 'E', judul: 'PEKERJAAN PEMBONGKARAN', items: E })

  // Ringkasan sesuai sheet RAB: Jumlah MDU-Hardware-Jasa, SLO 2,5%, PPN 11%, Jumlah Total, Terbilang
  const sub = { mdu: 0, hardware: 0, jasa: 0, total: 0 }
  for (const r of rows) for (const i of r.items) {
    const t = i.total || 0, k = kolomOf(i.gol)
    i[k] = t; sub[k] += t
  }
  const pctSlo = 0.025, pctPpn = 0.11
  const useSlo = rabOpt.slo !== false
  const slo = useSlo ? { pct: pctSlo, jumlah: (sub.mdu + sub.hardware + sub.jasa) * pctSlo } : null
  if (slo) sub.jasa += slo.jumlah
  sub.total = sub.mdu + sub.hardware + sub.jasa
  const ppn = { mdu: sub.mdu * pctPpn, hardware: sub.hardware * pctPpn, jasa: sub.jasa * pctPpn }; ppn.total = ppn.mdu + ppn.hardware + ppn.jasa
  const jum = { mdu: sub.mdu + ppn.mdu, hardware: sub.hardware + ppn.hardware, jasa: sub.jasa + ppn.jasa }; jum.total = jum.mdu + jum.hardware + jum.jasa
  const grand = jum.total
  return { rows, sub, slo, ppn, jum, grand, pctPpn, terbilang: terbilang(Math.round(grand)) }
}

const SATU = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
function bilang(n) {
  if (n < 12) return SATU[n]
  if (n < 20) return bilang(n - 10) + ' belas'
  if (n < 100) return bilang(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + bilang(n % 10) : '')
  if (n < 200) return 'seratus' + (n - 100 ? ' ' + bilang(n - 100) : '')
  if (n < 1000) return bilang(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + bilang(n % 100) : '')
  if (n < 2000) return 'seribu' + (n - 1000 ? ' ' + bilang(n - 1000) : '')
  if (n < 1e6) return bilang(Math.floor(n / 1000)) + ' ribu' + (n % 1000 ? ' ' + bilang(n % 1000) : '')
  if (n < 1e9) return bilang(Math.floor(n / 1e6)) + ' juta' + (n % 1e6 ? ' ' + bilang(n % 1e6) : '')
  if (n < 1e12) return bilang(Math.floor(n / 1e9)) + ' miliar' + (n % 1e9 ? ' ' + bilang(n % 1e9) : '')
  return String(n)
}
export function terbilang(n) {
  if (!n) return 'Nol Rupiah'
  const t = bilang(n).replace(/\b\w/g, (c) => c.toUpperCase())
  return `${t} Rupiah`
}
