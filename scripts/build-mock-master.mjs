// Membangun data master MOCK (public/mock/master.json) dari Excel contoh — tanpa database.
// Pemakaian: npm run mock:build [-- data/KKP_PB_53_KVA_PABRIK_ROKOK_HS.xlsx]
// Logika pembacaan sama dengan scripts/import-master.mjs (yang nanti mengisi PostgreSQL).
import ExcelJS from 'exceljs'
import { mkdirSync, writeFileSync } from 'node:fs'

const file = process.argv[2] || 'data/KKP_PB_53_KVA_PABRIK_ROKOK_HS.xlsx'
const norm = (s) => String(s ?? '').toLowerCase().replace(/⁰/g, '').replace(/\s+/g, ' ').trim()
const errCells = []
function val(cell, sheet, row, col) {
  let v = cell?.value
  if (v && typeof v === 'object') {
    if ('result' in v) v = v.result
    else if ('richText' in v) v = v.richText.map((t) => t.text).join('')
    else if ('text' in v) v = v.text
  }
  if (v && typeof v === 'object' && 'error' in v) { errCells.push(`${sheet}!${col}${row}`); return null }
  if (typeof v === 'string' && /^#(REF|NAME|VALUE|DIV\/0|N\/A)/.test(v)) { errCells.push(`${sheet}!${col}${row}`); return null }
  return v ?? null
}
const num = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null)

const harga = [], kons = []
const wb = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: 'cache', styles: 'ignore', hyperlinks: 'ignore', worksheets: 'emit' })
for await (const ws of wb) {
  const name = ws.name || ws._name
  if (name !== 'HARGA SATUAN' && name !== 'KONSTRUKSI') { for await (const _ of ws) { /* lewati */ } continue }
  let sec = null, grp = null, cur = null
  for await (const row of ws) {
    const r = row.number; if (r < 8) continue
    const c = (i, L) => val(row.getCell(i), name, r, L)
    if (name === 'HARGA SATUAN') {
      const b = c(2, 'B'), nama = c(3, 'C'), gol = c(4, 'D'), sat = c(5, 'E'), hss = num(c(6, 'F')) ?? num(c(12, 'L')), khs = num(c(7, 'G'))
      if (typeof b === 'string' && b.length <= 3 && nama && !gol && !c(6, 'F')) { sec = String(nama).trim(); continue }
      if (!nama || !gol) continue
      harga.push({ kelompok: sec || '-', nama: String(nama).trim(), gol: String(gol).trim().toUpperCase(), sat: sat ? String(sat) : null, hss, khs })
    } else {
      const b = c(2, 'B'), u = c(3, 'C'), sat = c(4, 'D'), vol = c(5, 'E')
      if (b === '#') { grp = String(u).trim(); continue }
      if (b === '+') { cur = { grup: grp, kode: String(u).trim(), items: [] }; kons.push(cur); continue }
      if (cur && u && b !== null && b !== '') cur.items.push({ u: String(u), s: sat ? String(sat) : null, v: typeof vol === 'number' ? vol : null })
    }
  }
}

// material unik (kelompok|nama|golongan) + indeks nama
const seen = new Set(), mat = []
for (const h of harga) { const k = `${h.kelompok}|${h.nama}|${h.gol}`; if (!seen.has(k)) { seen.add(k); mat.push(h) } }
const byName = new Map(); for (const m of mat) { const k = norm(m.nama); if (!byName.has(k)) byName.set(k, m) }
const exact = new Map(); for (const m of mat) if (!exact.has(m.nama)) exact.set(m.nama, m)

const konstruksi = kons.map((k) => {
  const upah = k.items.find((i) => /Upah Pasang.*\(.*Sudut/i.test(i.u))
  const sd = upah && /Sudut\s*(\d+)\D+(\d+)/.exec(upah.u)
  const desc = upah ? (/Upah Pasang.*?\((.*?)\)/.exec(upah.u) || [])[1] || '' : ''
  const items = k.items.map((i) => { const m = byName.get(norm(i.u)); return { u: i.u, s: i.s, v: i.v, hss: m?.hss ?? null, khs: m?.khs ?? null, gol: m?.gol ?? null } })
  const up = k.items.find((i) => /^Upah Pasang/.test(i.u))
  const mb = up && exact.get(up.u.replace(/^Upah Pasang/, 'Upah Bongkar'))
  return { grup: k.grup || '-', kode: k.kode, desc, smin: sd ? +sd[1] : null, smax: sd ? +sd[2] : null, items,
    bongkar: mb ? { u: mb.nama, s: mb.sat, hss: mb.hss, khs: mb.khs, gol: mb.gol } : null }
})
const pick = (m) => ({ nama: m.nama, sat: m.sat, gol: m.gol, hss: m.hss, khs: m.khs, kelompok: m.kelompok })
const tiang = mat.filter((m) => m.kelompok === 'TIANG BETON' && /^tiang/i.test(m.nama)).sort((a, b) => a.nama.localeCompare(b.nama)).map(pick)
const peralatan = mat.filter((m) => ['TRAFO DISTRIBUSI', 'SWITCH', 'LIGHTNING ARESTER', 'PEMBATAS & PROTEKSI'].includes(m.kelompok) && m.gol !== 'JASA')
  .sort((a, b) => a.kelompok.localeCompare(b.kelompok) || a.nama.localeCompare(b.nama)).map(pick)

const klasif = (nama) => {
  const n = nama.toUpperCase(), jtr = /NFA2X|NYFGBY|NYY|NYM|LVTC|TWISTED/.test(n) && !/MVTIC/.test(n)
  const m = /(?:^|[\s-])(\d)\s*x\s*\d/i.exec(nama)
  return { kelompok_garis: jtr ? 'JTR' : 'JTM', fasa: m ? (Number(m[1]) >= 3 ? 3 : 1) : 3 }
}
const upahPsg = mat.filter((m) => /^UPAH PASANG PENGHANTAR T[MR]$/.test(m.kelompok))
const upahBgk = mat.filter((m) => /^UPAH BONGKAR PENGHANTAR T[MR]$/.test(m.kelompok))
const key = (s) => norm(s).replace(/upah (pasang|bongkar) (penghantar|kabel)( tm| tr)?/g, '').replace(/^kabel /, '').replace(/[\s,+]/g, '')
const find = (list, nama) => {
  const e = list.find((u) => key(u.nama) === key(nama)); if (e) return e
  const a = /^AAAC(\/S)?\s+(\d+)/i.exec(nama); if (!a) return null
  const pre = `${a[1] ? 'a3cs' : 'a3c'}3x${a[2]}`
  return list.find((u) => key(u.nama).startsWith(pre + 'mm')) || list.find((u) => key(u.nama).startsWith(pre)) || null
}
const konduktor = mat.filter((m) => /^PENGHANTAR (KAWAT|KABEL)$/.test(m.kelompok) && m.gol !== 'JASA').map((m) => ({
  nama: m.nama, ...klasif(m.nama), sat: m.sat, gol: m.gol, hss: m.hss, khs: m.khs,
  upah_pasang: find(upahPsg, m.nama)?.hss ?? null, upah_bongkar: find(upahBgk, m.nama)?.hss ?? null,
})).sort((a, b) => a.nama.localeCompare(b.nama))

const out = {
  konstruksi, tiang, peralatan, konduktor,
  simbol: [], aturan: [], // kosong -> klien memakai bawaan src/lib/shared/symbols.js
  tarif: ['R1', 'R2', 'R3', 'B1', 'B2', 'B3', 'I1', 'I2', 'I3', 'I4', 'P1', 'P2', 'P3'],
}
mkdirSync('public/mock', { recursive: true })
writeFileSync('public/mock/master.json', JSON.stringify(out))
const kb = Math.round(JSON.stringify(out).length / 1024)
console.log(`master.json ${kb} KB — konstruksi ${konstruksi.length}, tiang ${tiang.length}, peralatan ${peralatan.length}, konduktor ${konduktor.length}, sel error dilewati ${errCells.length}`)
console.log('grup konstruksi:', [...new Set(konstruksi.map((k) => k.grup))].join(' | '))
