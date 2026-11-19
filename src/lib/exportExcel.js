import { hitungRab } from './rab'
import { gambarPng } from './gambarPng'

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const unduh = (blob, nama) => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
const bufDariUrl = async (u) => (await fetch(u)).arrayBuffer()
const bufDariDataUrl = (d) => Uint8Array.from(atob(d.split(',')[1]), (c) => c.charCodeAt(0))

// F9: ekspor Excel (sheet GAMBAR + RAB), dibuat langsung di perangkat — jalan juga saat offline.
export async function exportExcel(p) {
  const { default: ExcelJS } = await import('exceljs')
  const R = hitungRab(p), { rows } = R, d = { ...p, rabOpt: { harga: 'HSS', jenis: 'Total', asal: 'Gudang UP3', ...p.rabOpt } }
  const wb = new ExcelJS.Workbook(), g = wb.addWorksheet('GAMBAR', { views: [{ showGridLines: false }] }), r = wb.addWorksheet('RAB', { views: [{ showGridLines: false }] })

  // ===== GAMBAR: lembar gambar (area gambar + panel keterangan) sebagai gambar PNG satu halaman landscape =====
  try {
    const dataUrl = await gambarPng(p, 1.5), png = bufDariDataUrl(dataUrl)
    const lebar = new DataView(png.buffer).getUint32(16), tinggi = new DataView(png.buffer).getUint32(20), w = 1280, h = Math.round((tinggi * w) / lebar)
    const nRow = Math.ceil(h / 20) + 1, nCol = Math.ceil(w / 64) + 1
    g.addImage(wb.addImage({ buffer: png, extension: 'png' }), { tl: { col: 0.1, row: 0.1 }, ext: { width: w, height: h } })
    for (let i = 1; i <= nRow; i++) g.getRow(i).height = 15
    g.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 } }
    g.pageSetup.printArea = `A1:${g.getColumn(nCol).letter}${nRow}`
  } catch { g.getCell('A1').value = 'Gambar skematik gagal dibuat. Tandai minimal 2 titik di halaman Peta lalu ekspor ulang.' }

  // ===== RAB: mengikuti sheet RAB pada contoh =====
  const thin = { style: 'thin' }, med = { style: 'medium' }, F = { name: 'Calibri', size: 11 }, FB = { ...F, bold: true }
  ;[5.3, 50.7, 17.7, 8.7, 7.7, 12.7, 16.7, 16.7, 16.7, 16.7].forEach((w, i) => (r.getColumn(i + 1).width = w))
  r.getCell('B1').value = 'PT. PLN ( PERSERO )'; r.getCell('B2').value = (p.meta?.ulp ? `UP3 KLATEN - ${p.meta.ulp}` : 'UP3 KLATEN')
  r.getCell('B1').font = r.getCell('B2').font = FB
  try { r.addImage(wb.addImage({ buffer: await bufDariUrl('/logo-pln.png'), extension: 'png' }), { tl: { col: 0.15, row: 0.15 }, ext: { width: 44, height: 21 } }) } catch { /* tanpa logo */ }
  r.mergeCells('A5:J5'); const jd = r.getCell('A5'); jd.value = 'RENCANA ANGGARAN BIAYA (RAB)'; jd.font = FB; jd.alignment = { horizontal: 'center' }
  const kva = p.daya ? ` ${Math.round((p.daya / 1000) * 10) / 10} KVA` : ''
  ;[['PEKERJAAN', `${p.jenis === 'Tambah Daya' ? 'TD' : 'PB'}${kva} ${(p.nama || '').toUpperCase()}`], ['LOKASI', (p.meta?.ulp || p.lokasi || '').toUpperCase()], ['ANGGARAN', `INVESTASI TAHUN ${new Date().getFullYear()}`]]
    .forEach(([l, v], i) => { const n = 6 + i; r.getCell(`D${n}`).value = l; r.getCell(`E${n}`).value = ':'; r.getCell(`F${n}`).value = v; r.getCell(`D${n}`).font = r.getCell(`F${n}`).font = FB; r.getCell(`E${n}`).alignment = { horizontal: 'center' } })
  const H0 = 11
  const hd = (rng, t) => { r.mergeCells(rng); const c = r.getCell(rng.split(':')[0]); c.value = t; c.font = FB; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true } }
  ;[['A', 'NO'], ['B', 'URAIAN'], ['C', 'GOL'], ['D', 'SAT'], ['E', 'VOL'], ['F', 'HARGA\nSATUAN']].forEach(([c, t]) => hd(`${c}${H0}:${c}${H0 + 2}`, t))
  hd(`G${H0}:J${H0}`, 'BIAYA YANG DIPERLUKAN ( Rp )')
  ;[['G', 'MDU'], ['H', 'HARDWARE'], ['I', 'JASA'], ['J', 'JUMLAH']].forEach(([c, t]) => hd(`${c}${H0 + 1}:${c}${H0 + 2}`, t))
  for (let rr = H0; rr <= H0 + 2; rr++) for (let c = 1; c <= 10; c++) r.getCell(rr, c).border = { top: rr === H0 ? med : undefined, bottom: rr === H0 + 2 ? med : undefined, left: c === 1 ? med : thin, right: c === 10 ? med : thin }
  const angka = '#,##0;-#,##0;;@'
  let row = H0 + 3
  const tulis = (v, o = {}) => {
    const x = r.getRow(row++)
    v.forEach((val, i) => { if (val !== null && val !== undefined && val !== '') x.getCell(i + 1).value = val })
    for (let c = 1; c <= 10; c++) {
      const cell = x.getCell(c)
      cell.font = o.bold ? FB : F
      cell.border = { left: c === 1 ? med : thin, right: c === 10 ? med : thin }
      cell.alignment = { horizontal: c === 2 ? 'left' : 'center', vertical: 'middle' }
      if (c >= 6) cell.numFmt = angka
      if (c === 5) cell.numFmt = 'General'
    }
    return x
  }
  tulis([])
  for (const k of rows) {
    tulis([k.kelompok, k.judul]); let last = null, n = 0
    k.items.forEach((i) => {
      if (i.konstruksi && i.konstruksi !== last) { if (last) tulis([]); last = i.konstruksi; n = 0; tulis(['+', i.konstruksi, '', 'Unit', i.unit || '']) }
      n++; tulis([i.konstruksi ? n : '', i.nama, i.gol, i.sat, i.vol, i.price, i.mdu, i.hardware, i.jasa, i.total])
    })
    tulis([])
  }
  if (R.slo) { tulis(['', 'SLO'], { bold: true }); tulis([1, 'Sertifikasi Laik Operasi (2,5% dari jumlah)', 'JASA', 'Lot', 1, R.slo.jumlah, null, null, R.slo.jumlah, R.slo.jumlah]); tulis([]) }
  const sm = (lab, v, bold) => tulis(['', lab, '', '', '', ':', v.mdu, v.hardware, v.jasa, v.total], { bold })
  const sumRow = row
  sm('Jumlah MDU - Hardware - Jasa', R.sub); sm(`PPN ${Math.round(R.pctPpn * 100)}%`, R.ppn); sm('Jumlah Total', R.jum, true)
  for (let c = 1; c <= 10; c++) { r.getCell(sumRow, c).border = { ...r.getCell(sumRow, c).border, top: med }; r.getCell(row - 1, c).border = { ...r.getCell(row - 1, c).border, bottom: med } }
  r.mergeCells(`A${row}:J${row}`); const tb = r.getCell(`A${row}`); tb.value = `Terbilang : ( ${R.terbilang} )`; tb.font = FB; tb.alignment = { horizontal: 'left' }
  for (let c = 1; c <= 10; c++) r.getCell(row, c).border = { left: c === 1 ? med : undefined, right: c === 10 ? med : undefined, bottom: med }
  row += 2
  r.getCell(`A${row}`).value = `Harga yang dipakai adalah ${d.rabOpt.harga} 2024 · Jenis ${d.rabOpt.jenis} · Asal material ${d.rabOpt.asal}`; r.getCell(`A${row}`).font = FB
  row += 2
  const t = new Date()
  r.mergeCells(`G${row}:J${row}`); r.getCell(`G${row}`).value = `Klaten, ${t.getDate()} ${BLN[t.getMonth()]} ${t.getFullYear()}`
  r.mergeCells(`G${row + 1}:J${row + 1}`); r.getCell(`G${row + 1}`).value = 'Dibuat Oleh,'
  r.mergeCells(`G${row + 5}:J${row + 5}`); r.getCell(`G${row + 5}`).value = p.meta?.digambar || ''
  for (const n of [row, row + 1, row + 5]) { r.getCell(`G${n}`).alignment = { horizontal: 'center' }; r.getCell(`G${n}`).font = n === row + 5 ? FB : F }
  r.pageSetup = { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
  r.pageSetup.printArea = `A1:J${row + 5}`; r.pageSetup.printTitlesRow = `${H0}:${H0 + 2}`

  const buf = await wb.xlsx.writeBuffer()
  unduh(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${(p.nomor || 'project').replace(/[^\w-]+/g, '_')}.xlsx`)
}
