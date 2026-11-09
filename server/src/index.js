import express from 'express'
import compression from 'compression'
import cors from 'cors'
import http from 'node:http'
import crypto from 'node:crypto'
import { Server as IOServer } from 'socket.io'
import ExcelJS from 'exceljs'
import { pool, q } from './db.js'
import { migrate } from './migrate.js'
import { docFromRows, extraOf, titikRow } from './mapper.js'
import { hitungRab, spans } from '../../shared/rab.js'

const app = express()
const server = http.createServer(app)
const io = new IOServer(server, { cors: { origin: true } })
app.use(cors()); app.use(compression()); app.use(express.json({ limit: '5mb' }))
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: e.message }) })

app.get('/api/health', wrap(async (_, res) => { await q('SELECT 1'); res.json({ ok: true }) }))

// ===== Data master =====
// Seluruh konstruksi + isi (dipakai klien, disimpan di perangkat agar jalan offline)
const KONS_SQL = (where = '') => `
    SELECT k.id, k.kelompok AS grup, k.kode, k.uraian AS "desc", k.sudut_min AS smin, k.sudut_maks AS smax,
      COALESCE(json_agg(json_build_object('u', i.uraian, 's', i.satuan, 'v', i.volume, 'hss', m.hss_2024, 'khs', m.khs_2024, 'gol', m.golongan) ORDER BY i.urut)
               FILTER (WHERE i.id IS NOT NULL), '[]') AS items,
      (SELECT json_build_object('u', mb.nama, 's', mb.satuan, 'hss', mb.hss_2024, 'khs', mb.khs_2024, 'gol', mb.golongan)
         FROM konstruksi_item up JOIN material mb ON mb.nama = regexp_replace(up.uraian, '^Upah Pasang', 'Upah Bongkar')
        WHERE up.konstruksi_id = k.id AND up.uraian LIKE 'Upah Pasang%' LIMIT 1) AS bongkar
    FROM konstruksi k LEFT JOIN konstruksi_item i ON i.konstruksi_id = k.id LEFT JOIN material m ON m.id = i.material_id
    ${where} GROUP BY k.id ORDER BY k.id`
// Seluruh konstruksi + isi (dipakai klien, disimpan di perangkat agar jalan offline)
app.get('/api/master/konstruksi', wrap(async (_, res) => {
  const { rows } = await q(KONS_SQL())
  res.json(rows.map(({ id, ...r }) => r))
}))
const dropdown = (kelompok) => wrap(async (req, res) => {
  const term = `%${req.query.q || ''}%`
  const { rows } = await q(`SELECT nama, satuan AS sat, golongan AS gol, hss_2024 AS hss, khs_2024 AS khs, kelompok FROM material
    WHERE kelompok = ANY($1) AND golongan <> 'JASA' AND nama ILIKE $2 ORDER BY kelompok, nama LIMIT 200`, [kelompok, term])
  res.json(rows)
})
app.get('/api/master/tiang', wrap(async (req, res) => {
  const { rows } = await q(`SELECT nama, satuan AS sat, golongan AS gol, hss_2024 AS hss, khs_2024 AS khs, kelompok FROM material WHERE kelompok='TIANG BETON' AND nama ILIKE 'Tiang%' AND nama ILIKE $1 ORDER BY nama`, [`%${req.query.q || ''}%`])
  res.json(rows)
}))
app.get('/api/master/peralatan', dropdown(['TRAFO DISTRIBUSI', 'SWITCH', 'LIGHTNING ARESTER', 'PEMBATAS & PROTEKSI']))
app.get('/api/master/konduktor', wrap(async (req, res) => {
  const { rows } = await q(`SELECT k.kode AS nama, k.kelompok_garis, k.fasa, m.satuan AS sat, m.golongan AS gol, m.hss_2024 AS hss, m.khs_2024 AS khs,
      up.hss_2024 AS upah_pasang, ub.hss_2024 AS upah_bongkar
    FROM konduktor k LEFT JOIN material m ON m.id = k.material_id LEFT JOIN material up ON up.id = k.upah_pasang_id LEFT JOIN material ub ON ub.id = k.upah_bongkar_id
    WHERE k.kode ILIKE $1 ORDER BY k.kode`, [`%${req.query.q || ''}%`])
  res.json(rows)
}))
app.get('/api/master/konstruksi-kode', wrap(async (req, res) => {
  const { rows } = await q(`SELECT kode, kelompok AS grup FROM konstruksi WHERE ($1::text IS NULL OR kelompok = $1) AND kode ILIKE $2 ORDER BY id LIMIT 200`, [req.query.grup || null, `%${req.query.q || ''}%`])
  res.json(rows)
}))
app.get('/api/simbol', wrap(async (_, res) => {
  res.json({ simbol: (await q('SELECT * FROM simbol ORDER BY urut')).rows, aturan: (await q('SELECT sumber, pola, simbol, prioritas FROM aturan_simbol')).rows })
}))
// satu paket master untuk klien (offline-first)
app.get('/api/master', wrap(async (req, res) => {
  const base = `http://127.0.0.1:${PORT}`
  const get = (p) => fetch(base + p).then((r) => r.json())
  const [konstruksi, tiang, peralatan, konduktor, sim] = await Promise.all(['/api/master/konstruksi', '/api/master/tiang', '/api/master/peralatan', '/api/master/konduktor', '/api/simbol'].map(get))
  res.json({ konstruksi, tiang, peralatan, konduktor, ...sim, at: new Date().toISOString() })
}))

// ===== Project =====
const loadDoc = async (kode, client = pool) => {
  const p = (await client.query('SELECT * FROM proyek WHERE kode_project=$1 AND NOT deleted', [kode])).rows[0]
  if (!p) return null
  const t = (await client.query('SELECT * FROM titik_tagging WHERE proyek_id=$1 AND NOT deleted ORDER BY urutan', [p.id])).rows
  return docFromRows(p, t)
}
const saveDoc = async (client, id, kode, d, isNew) => {
  const vals = [id, kode, d.nomor || null, d.nama, d.jenis, d.lokasi || null, d.tarif || null, Number(d.daya) || 0, d.status || 'Draft', d.jalur || null, JSON.stringify(extraOf(d))]
  if (isNew) await client.query(`INSERT INTO proyek (id,kode_project,nomor,nama,jenis,lokasi,tarif,daya,status,jalur,extra) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, vals)
  else await client.query(`UPDATE proyek SET nomor=$2,nama=$3,jenis=$4,lokasi=$5,tarif=$6,daya=$7,status=$8,jalur=$9,extra=$10,version=version+1,updated_at=now() WHERE id=$1`, [vals[0], ...vals.slice(2)])
  const ids = []
  for (const [i, t] of (d.points || []).entries()) {
    const r = titikRow(t, i); ids.push(r.id)
    await client.query(`INSERT INTO titik_tagging (id,proyek_id,urutan,lat,lng,nomor_tiang,jenis_tiang,jenis_peralatan,jenis_konduktor,panjang_konduktor,konstruksi_baru,kode_manual,konstruksi_lama,konstruksi_bongkar,kondisi,tinggi_lintasan,sudut)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (id) DO UPDATE SET urutan=$3,lat=$4,lng=$5,nomor_tiang=$6,jenis_tiang=$7,jenis_peralatan=$8,jenis_konduktor=$9,panjang_konduktor=$10,konstruksi_baru=$11,kode_manual=$12,konstruksi_lama=$13,konstruksi_bongkar=$14,kondisi=$15,tinggi_lintasan=$16,sudut=$17,deleted=false,version=titik_tagging.version+1,updated_at=now()
      WHERE titik_tagging.proyek_id=$2`,
      [r.id, id, r.urutan, r.lat, r.lng, r.nomor_tiang, r.jenis_tiang, r.jenis_peralatan, r.jenis_konduktor, r.panjang_konduktor, r.konstruksi_baru, r.kode_manual, r.konstruksi_lama, r.konstruksi_bongkar, r.kondisi, r.tinggi_lintasan, r.sudut])
  }
  await client.query(`UPDATE titik_tagging SET deleted=true, updated_at=now() WHERE proyek_id=$1 AND NOT deleted AND NOT (id = ANY($2::uuid[]))`, [id, ids]) // hapus lunak
}
const KODE_OK = /^[A-Za-z0-9_-]{8,32}$/
const newKode = () => crypto.randomBytes(8).toString('base64url').replace(/[-_]/g, 'x').slice(0, 10)
const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(s || '')

app.get('/api/proyek', wrap(async (req, res) => {
  const term = `%${req.query.q || ''}%`
  const { rows } = await q(`SELECT p.kode_project AS kode, p.nomor, p.nama, p.jenis, p.lokasi, p.tarif, p.daya, p.status, p.version, p.updated_at,
      (SELECT count(*) FROM titik_tagging t WHERE t.proyek_id=p.id AND NOT t.deleted)::int AS titik
    FROM proyek p WHERE NOT p.deleted AND (p.nama ILIKE $1 OR p.nomor ILIKE $1 OR p.lokasi ILIKE $1 OR p.kode_project = $2) ORDER BY p.updated_at DESC LIMIT 100`, [term, req.query.q || ''])
  res.json(rows)
}))
app.get('/api/proyek/:kode', wrap(async (req, res) => {
  const d = await loadDoc(req.params.kode); d ? res.json(d) : res.status(404).json({ error: 'Project tidak ditemukan' })
}))
// buat / simpan (PUT). baseVersion = versi yang dipegang klien; beda -> 409 + dokumen server (pop-up pilih versi)
app.put('/api/proyek/:kode', wrap(async (req, res) => {
  const kode = req.params.kode, d = req.body || {}
  if (!KODE_OK.test(kode) || !isUuid(d.id) || !d.nama) return res.status(400).json({ error: 'Data tidak valid' })
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const ex = (await c.query('SELECT id, version FROM proyek WHERE kode_project=$1 FOR UPDATE', [kode])).rows[0]
    if (!ex) { await saveDoc(c, d.id, kode, d, true) }
    else {
      if (!req.query.force && Number(d.baseVersion) !== ex.version) { await c.query('ROLLBACK'); return res.status(409).json({ conflict: true, server: await loadDoc(kode) }) }
      await saveDoc(c, ex.id, kode, d, false)
    }
    await c.query('COMMIT')
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
  const doc = await loadDoc(kode)
  io.to(kode).emit('proyek:diubah', { kode, version: doc.version, from: req.get('x-client-id') || null })
  res.json(doc)
}))
app.delete('/api/proyek/:kode', wrap(async (req, res) => {
  await q('UPDATE proyek SET deleted=true, version=version+1, updated_at=now() WHERE kode_project=$1', [req.params.kode]); res.json({ ok: true })
}))
app.post('/api/proyek/:kode/salin', wrap(async (req, res) => {
  const d = await loadDoc(req.params.kode); if (!d) return res.status(404).json({ error: 'Project tidak ditemukan' })
  const kode = newKode(), id = crypto.randomUUID(), c = await pool.connect()
  try {
    await c.query('BEGIN')
    await saveDoc(c, id, kode, { ...d, nama: d.nama + ' (salinan)', nomor: (d.nomor || '') + '-SALIN', status: 'Draft', points: d.points.map((t) => ({ ...t, id: crypto.randomUUID() })) }, true)
    await c.query('COMMIT')
  } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
  res.json(await loadDoc(kode))
}))

// ===== Foto per pekerjaan =====
app.post('/api/proyek/:kode/foto', express.raw({ type: 'image/*', limit: '8mb' }), wrap(async (req, res) => {
  const p = (await q('SELECT id FROM proyek WHERE kode_project=$1 AND NOT deleted', [req.params.kode])).rows[0]
  if (!p || !req.body?.length) return res.status(400).json({ error: 'Tidak valid' })
  const id = req.get('x-foto-id') && isUuid(req.get('x-foto-id')) ? req.get('x-foto-id') : crypto.randomUUID()
  await q('INSERT INTO foto (id,proyek_id,mime,data) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING', [id, p.id, req.get('content-type'), req.body])
  io.to(req.params.kode).emit('proyek:diubah', { kode: req.params.kode, foto: true })
  res.json({ id })
}))
app.get('/api/proyek/:kode/foto', wrap(async (req, res) => {
  res.json((await q(`SELECT f.id FROM foto f JOIN proyek p ON p.id=f.proyek_id WHERE p.kode_project=$1 AND NOT f.deleted ORDER BY f.created_at`, [req.params.kode])).rows.map((r) => r.id))
}))
app.get('/api/foto/:id', wrap(async (req, res) => {
  const f = (await q('SELECT mime,data FROM foto WHERE id=$1 AND NOT deleted', [req.params.id])).rows[0]
  if (!f) return res.sendStatus(404); res.type(f.mime).send(f.data)
}))
app.delete('/api/foto/:id', wrap(async (req, res) => { await q('UPDATE foto SET deleted=true WHERE id=$1', [req.params.id]); res.json({ ok: true }) }))

// ===== RAB & ekspor Excel (dihitung di server memakai master di database) =====
async function rabCtx(doc) {
  const kodes = [...new Set(doc.points.flatMap((p) => [p.kodeManual || p.kode, p.konsBongkar]).filter(Boolean))]
  const kons = (await q(KONS_SQL('WHERE k.kode = ANY($1) AND k.kelompok = $2'), [kodes, doc.jalur])).rows
  const km = Object.fromEntries(kons.map((k) => [k.kode, k]))
  const names = [...new Set(doc.points.flatMap((p) => [p.jenisTiang, p.konduktor, p.peralatan]).filter(Boolean))]
  const mats = (await q('SELECT nama, satuan AS sat, golongan AS gol, hss_2024 AS hss, khs_2024 AS khs FROM material WHERE nama = ANY($1) AND golongan <> $2', [names, 'JASA'])).rows
  const mm = Object.fromEntries(mats.map((m) => [m.nama, m]))
  return { getKons: (kode) => km[kode], tiang: mm, konduktor: mm, peralatan: mm }
}
const withOpt = (doc, req) => ({ ...doc, rabOpt: { harga: req.query.harga || doc.rabOpt?.harga || 'HSS', jenis: req.query.jenis || doc.rabOpt?.jenis || 'Total', asal: req.query.asal || doc.rabOpt?.asal || 'Gudang UP3', slo: req.query.slo != null ? req.query.slo !== '0' : doc.rabOpt?.slo } })
app.get('/api/proyek/:kode/rab', wrap(async (req, res) => {
  const doc = await loadDoc(req.params.kode); if (!doc) return res.sendStatus(404)
  const d = withOpt(doc, req); res.json({ opsi: d.rabOpt, ...hitungRab(d, await rabCtx(d)) })
}))
const exportXlsx = wrap(async (req, res) => {
  const doc = await loadDoc(req.params.kode); if (!doc) return res.sendStatus(404)
  const d = withOpt(doc, req), R = hitungRab(d, await rabCtx(d)), { rows } = R
  const wb = new ExcelJS.Workbook(), g = wb.addWorksheet('GAMBAR'), r = wb.addWorksheet('RAB')
  const bold = (row) => { row.font = { bold: true } }
  g.addRow(['GAMBAR SKEMATIK JARINGAN']).font = { bold: true, size: 14 }; g.addRow([])
  // Gambar skematik dikirim klien sebagai PNG; ditempel di atas tabel data.
  const png = typeof req.body?.png === 'string' && /^data:image\/png;base64,/.test(req.body.png) ? Buffer.from(req.body.png.split(',')[1], 'base64') : null
  if (png && png.length > 100) {
    const lebar = png.readUInt32BE(16), tinggi = png.readUInt32BE(20), w = 1100, h = Math.round((tinggi * w) / lebar)
    g.addImage(wb.addImage({ buffer: png, extension: 'png' }), { tl: { col: 0, row: 2 }, ext: { width: w, height: h } })
    for (let i = 0; i < Math.ceil(h / 20) + 2; i++) g.addRow([])
  }
  g.addRows([['No. Gambar', d.meta?.noGambar], ['Skala', d.meta?.skala], ['Perihal', d.meta?.perihal], ['Pelanggan', d.nama], ['Lokasi', d.lokasi], []])
  bold(g.addRow(['No', 'Nomor Tiang', 'Kode Konstruksi', 'Sudut', 'Jenis Tiang', 'Peralatan', 'Penghantar', 'Jarak dari titik sebelumnya (m)', 'Status', 'Konstruksi Lama', 'Konstruksi Bongkar', 'Lat', 'Lng']))
  const sp = spans(d.points)
  d.points.forEach((p, i) => g.addRow([i + 1, p.nomor, p.kodeManual || p.kode, p.sudut, p.jenisTiang, p.peralatan, p.konduktor, i ? sp[i - 1] : 0, p.kondisi, p.konsLama, p.konsBongkar, p.lat, p.lng]))
  g.addRow([]); bold(g.addRow(['Penyeberangan']))
  ;(d.crossings || []).forEach((c) => g.addRow([c.type, c.label, c.tinggi ? c.tinggi + ' m' : '', c.lat, c.lng]))
  g.addRow([]); ;['digambar', 'diperiksa', 'diketahui', 'disetujui'].forEach((k) => g.addRow([k[0].toUpperCase() + k.slice(1), d.meta?.[k]]))
  g.columns.forEach((c) => (c.width = 18))
  r.addRow(['PT PLN (PERSERO) UP3 KLATEN']).font = { bold: true }
  r.addRow(['RENCANA ANGGARAN BIAYA (RAB)']).font = { bold: true, size: 14 }
  r.addRows([['PEKERJAAN', ':', `${d.jenis === 'Tambah Daya' ? 'TD' : 'PB'} ${(d.nama || '').toUpperCase()}${d.daya ? ' ' + d.daya + ' VA' : ''}`], ['LOKASI', ':', d.lokasi], ['ANGGARAN', ':', `INVESTASI TAHUN ${new Date().getFullYear()} - asal material: ${d.rabOpt.asal}`], []])
  const hd = r.addRow(['NO', 'URAIAN', 'GOL', 'SAT', 'VOL', 'HARGA SATUAN', 'MDU', 'HARDWARE', 'JASA', 'JUMLAH'])
  hd.font = { bold: true, color: { argb: 'FFFFFFFF' } }; hd.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A5C94' } }; c.alignment = { horizontal: 'center' } })
  for (const k of rows) {
    const h = r.addRow([k.kelompok, k.judul]); h.font = { bold: true }; h.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4F1FA' } }))
    let last = null, n = 0
    k.items.forEach((i, idx) => {
      if (i.konstruksi && i.konstruksi !== last) { last = i.konstruksi; n = 0; r.addRow(['+', i.konstruksi, '', '', '', i.unit ? i.unit + ' Unit' : '']).font = { bold: true } }
      n++; r.addRow([i.konstruksi ? n : idx + 1, i.nama, i.gol, i.sat, i.vol, i.price, i.mdu, i.hardware, i.jasa, i.total])
    })
  }
  if (R.slo) { const s = r.addRow([1, 'Sertifikasi Laik Operasi', 'JASA', 'Lot', 1, '2,5%', null, null, R.slo.jumlah, R.slo.jumlah]); s.font = { bold: true }; s.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7B0' } })) }
  const sm = (lab, v, strong) => { const x = r.addRow(['', lab + ' :', '', '', '', '', v.mdu, v.hardware, v.jasa, v.total]); x.font = { bold: true }; if (strong) x.eachCell((c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4F1FA' } })) }
  sm('Jumlah MDU - Hardware - Jasa', R.sub); sm(`PPN ${Math.round(R.pctPpn * 100)}%`, R.ppn); sm('Jumlah Total', R.jum, true)
  r.addRow([]); r.addRow(['', `Terbilang : ( ${R.terbilang} )`]).font = { italic: true }
  r.addRow(['', `Harga yang dipakai adalah ${d.rabOpt.harga} 2024`]).font = { italic: true }
  r.columns = [{ width: 6 }, { width: 62 }, { width: 8 }, { width: 7 }, { width: 9 }, { width: 15 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 18 }]
  for (const c of [6, 7, 8, 9, 10]) r.getColumn(c).numFmt = '#,##0'
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${(d.nomor || 'project').replace(/[^\w-]+/g, '_')}.xlsx"`)
  await wb.xlsx.write(res); res.end()
})
app.get('/api/proyek/:kode/export.xlsx', exportXlsx)
app.post('/api/proyek/:kode/export.xlsx', exportXlsx)

// ===== Real time (Socket.IO): klien bergabung ke ruang berdasarkan kode project =====
io.on('connection', (s) => {
  s.on('join', (kode) => KODE_OK.test(kode || '') && s.join(kode))
  s.on('leave', (kode) => s.leave(kode))
})

const PORT = Number(process.env.PORT || 3000)
for (let i = 0; ; i++) {
  try { await migrate(); break } catch (e) { if (i > 20) throw e; console.log('Menunggu database…', e.code || e.message); await new Promise((r) => setTimeout(r, 2000)) }
}
server.listen(PORT, () => console.log(`API siap di :${PORT}`))
