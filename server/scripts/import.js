// Impor data master dari Excel (HARGA SATUAN dan KONSTRUKSI) ke PostgreSQL.
// Pemakaian:  npm run import -- /data/file.xlsx
// - Aman dijalankan berulang (upsert, tidak menggandakan data)
// - Sel #REF! / #NAME? -> harga kosong dan dicatat, impor tidak berhenti
import ExcelJS from 'exceljs'
import { pool, q } from '../src/db.js'
import { migrate } from '../src/migrate.js'

const file = process.argv[2]
if (!file) { console.error('Pemakaian: npm run import -- <file.xlsx>'); process.exit(1) }

const norm = (s) => String(s ?? '').toLowerCase().replace(/⁰/g, '').replace(/\s+/g, ' ').trim()
const skipped = [], errCells = []
const log = (sheet, row, alasan) => skipped.push({ sheet, row, alasan })

// nilai sel yang aman: formula -> hasilnya; error -> null (dicatat)
function val(cell, sheet, row, col) {
  let v = cell?.value
  if (v && typeof v === 'object') {
    if ('result' in v) v = v.result
    else if ('richText' in v) v = v.richText.map((t) => t.text).join('')
    else if ('text' in v) v = v.text
  }
  if (v && typeof v === 'object' && 'error' in v) { errCells.push(`${sheet}!${col}${row} ${v.error}`); return null }
  if (typeof v === 'string' && /^#(REF|NAME|VALUE|DIV\/0|N\/A)/.test(v)) { errCells.push(`${sheet}!${col}${row} ${v}`); return null }
  return v ?? null
}
const num = (v) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null)

async function readSheets() {
  const wb = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: 'cache', styles: 'ignore', hyperlinks: 'ignore', worksheets: 'emit' })
  const out = { harga: [], kons: [] }
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
        if (!nama && !gol) continue
        if (!nama) { log(name, r, 'nama kosong'); continue }
        if (!gol) { log(name, r, `golongan kosong (${nama})`); continue }
        out.harga.push({ kelompok: sec || '-', nama: String(nama).trim(), gol: String(gol).trim().toUpperCase(), sat: sat ? String(sat) : null, hss, khs, r })
      } else {
        const b = c(2, 'B'), u = c(3, 'C'), sat = c(4, 'D'), vol = c(5, 'E')
        if (b === '#') { grp = String(u).trim(); continue }
        if (b === '+') { cur = { grup: grp, kode: String(u).trim(), items: [] }; out.kons.push(cur); continue }
        if (cur && u && b !== null && b !== '') cur.items.push({ u: String(u), s: sat ? String(sat) : null, v: typeof vol === 'number' ? vol : null })
      }
    }
  }
  return out
}

const klasifKonduktor = (nama) => {
  const n = nama.toUpperCase()
  const jtr = /NFA2X|NYFGBY|NYY|NYM|LVTC|TWISTED/.test(n) && !/MVTIC/.test(n)
  const m = /(?:^|[\s-])(\d)\s*x\s*\d/i.exec(nama)
  const fasa = m ? (Number(m[1]) >= 3 ? 3 : 1) : 3
  return { kelompok: jtr ? 'JTR' : 'JTM', fasa }
}

async function main() {
  await migrate()
  console.log('Membaca', file, '…')
  const { harga, kons } = await readSheets()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // ---- material (upsert; duplikat dalam file dilewati)
    const seen = new Set(); const rows = []
    for (const h of harga) {
      const k = `${h.kelompok}|${h.nama}|${h.gol}`
      if (seen.has(k)) { log('HARGA SATUAN', h.r, `duplikat (${h.nama})`); continue }
      seen.add(k); rows.push(h)
    }
    for (let i = 0; i < rows.length; i += 500) {
      const s = rows.slice(i, i + 500)
      await client.query(
        `INSERT INTO material (kelompok,nama,golongan,satuan,hss_2024,khs_2024)
         SELECT * FROM unnest($1::text[],$2::text[],$3::text[],$4::text[],$5::numeric[],$6::numeric[])
         ON CONFLICT (kelompok,nama,golongan) DO UPDATE SET satuan=EXCLUDED.satuan, hss_2024=EXCLUDED.hss_2024, khs_2024=EXCLUDED.khs_2024`,
        [s.map((x) => x.kelompok), s.map((x) => x.nama), s.map((x) => x.gol), s.map((x) => x.sat), s.map((x) => x.hss), s.map((x) => x.khs)])
    }
    const mat = (await client.query('SELECT id,kelompok,nama,golongan FROM material')).rows
    const byName = new Map(); for (const m of mat) { const k = norm(m.nama); if (!byName.has(k)) byName.set(k, m.id) }

    // ---- konstruksi + item
    let nItem = 0, nTanpaMaterial = 0
    for (const k of kons) {
      const upah = k.items.find((i) => /Upah Pasang.*\(.*Sudut/i.test(i.u))
      const sd = upah && /Sudut\s*(\d+)\D+(\d+)/.exec(upah.u)
      const desc = upah ? (/Upah Pasang.*?\((.*?)\)/.exec(upah.u) || [])[1] || '' : ''
      const id = (await client.query(
        `INSERT INTO konstruksi (kelompok,kode,uraian,sudut_min,sudut_maks) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (kelompok,kode) DO UPDATE SET uraian=$3, sudut_min=$4, sudut_maks=$5 RETURNING id`,
        [k.grup || '-', k.kode, desc, sd ? +sd[1] : null, sd ? +sd[2] : null])).rows[0].id
      await client.query('DELETE FROM konstruksi_item WHERE konstruksi_id=$1', [id])
      if (!k.items.length) continue
      const mids = k.items.map((i) => byName.get(norm(i.u)) ?? null)
      nItem += k.items.length; nTanpaMaterial += mids.filter((m) => m == null).length
      await client.query(
        `INSERT INTO konstruksi_item (konstruksi_id,urut,uraian,satuan,volume,material_id)
         SELECT $1,* FROM unnest($2::int[],$3::text[],$4::text[],$5::numeric[],$6::int[])`,
        [id, k.items.map((_, i) => i + 1), k.items.map((i) => i.u), k.items.map((i) => i.s), k.items.map((i) => i.v), mids])
    }

    // ---- konduktor (dari kelompok penghantar) + upah pasang/bongkar
    const kond = mat.filter((m) => /^PENGHANTAR (KAWAT|KABEL)$/.test(m.kelompok) && m.golongan !== 'JASA')
    const upahPsg = mat.filter((m) => m.kelompok === 'UPAH PASANG PENGHANTAR TM' || m.kelompok === 'UPAH PASANG PENGHANTAR TR')
    const upahBgk = mat.filter((m) => m.kelompok === 'UPAH BONGKAR PENGHANTAR TM' || m.kelompok === 'UPAH BONGKAR PENGHANTAR TR')
    const key = (s) => norm(s).replace(/upah (pasang|bongkar) (penghantar|kabel)( tm| tr)?/g, '').replace(/^kabel /, '').replace(/[\s,+]/g, '')
    const find = (list, nama) => {
      const exact = list.find((u) => key(u.nama) === key(nama))
      if (exact) return exact.id
      // Nama material dan upah berbeda (PRD): AAAC -> upah A3C, AAAC/S -> A3CS (perlu dikonfirmasi pengguna)
      const a = /^AAAC(\/S)?\s+(\d+)/i.exec(nama)
      if (!a) return null
      const pre = `${a[1] ? 'a3cs' : 'a3c'}3x${a[2]}`
      return (list.find((u) => key(u.nama).startsWith(pre + 'mm')) || list.find((u) => key(u.nama).startsWith(pre)))?.id ?? null
    }
    let nKond = 0, kondTanpaUpah = 0
    for (const m of kond) {
      const { kelompok, fasa } = klasifKonduktor(m.nama)
      const up = find(upahPsg, m.nama), ub = find(upahBgk, m.nama)
      if (!up || !ub) kondTanpaUpah++
      await client.query(
        `INSERT INTO konduktor (kode,kelompok_garis,fasa,material_id,upah_pasang_id,upah_bongkar_id) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (kode) DO UPDATE SET kelompok_garis=$2, fasa=$3, material_id=$4, upah_pasang_id=$5, upah_bongkar_id=$6`,
        [m.nama, kelompok, fasa, m.id, up, ub]); nKond++
    }
    await client.query('COMMIT')

    // ---- ringkasan
    const perKel = {}; for (const m of mat) perKel[m.kelompok] = (perKel[m.kelompok] || 0) + 1
    console.log('\n===== RINGKASAN IMPOR =====')
    console.log(`Material : ${rows.length} baris (${Object.keys(perKel).length} kelompok)`)
    Object.entries(perKel).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, n]) => console.log(`   - ${k}: ${n}`))
    if (Object.keys(perKel).length > 12) console.log('   - …')
    const noKhs = rows.filter((r) => r.khs == null && r.gol !== 'JASA').length
    console.log(`Harga KHS 2024 kosong (memang tidak ada di sumber): ${noKhs} material`)
    console.log(`Konstruksi: ${kons.length} kode, ${nItem} item (${nTanpaMaterial} item belum cocok ke material)`)
    console.log(`Konduktor : ${nKond} (${kondTanpaUpah} tanpa pasangan upah pasang/bongkar)`)
    console.log(`Sel error dilewati (#REF!/#NAME?): ${errCells.length}${errCells.length ? ' — contoh: ' + errCells.slice(0, 5).join(', ') : ''}`)
    console.log(`Baris dilewati: ${skipped.length}`)
    const per = {}; skipped.forEach((s) => (per[s.alasan.replace(/\(.*\)/, '')] = (per[s.alasan.replace(/\(.*\)/, '')] || 0) + 1))
    Object.entries(per).forEach(([a, n]) => console.log(`   - ${a.trim()}: ${n}`))
  } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
  await pool.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
