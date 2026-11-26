import * as XLSX from 'xlsx'
import { hitungRab, spans } from './rab'

// F9: ekspor Excel (sheet GAMBAR + RAB). Online & sudah tersinkron -> dibuat server (exceljs); offline -> dibuat di perangkat.
export function exportExcel(p) {
  if (navigator.onLine && p.version && !p.dirty) {
    const a = document.createElement('a')
    a.href = `/api/proyek/${p.kode}/export.xlsx?harga=${p.rabOpt.harga}&jenis=${encodeURIComponent(p.rabOpt.jenis)}&asal=${encodeURIComponent(p.rabOpt.asal)}&slo=${p.rabOpt.slo === false ? 0 : 1}`
    a.download = ''; document.body.appendChild(a); a.click(); a.remove(); return
  }
  const wb = XLSX.utils.book_new(), sp = spans(p.points)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['GAMBAR SKEMATIK JARINGAN'], [], ['No. Gambar', p.meta.noGambar], ['Skala', p.meta.skala], ['Perihal', p.meta.perihal], ['Pelanggan', p.nama], ['Lokasi', p.lokasi], [],
    ['No', 'Nomor Tiang', 'Kode Konstruksi', 'Sudut', 'Jenis Tiang', 'Peralatan', 'Penghantar', 'Jarak (m)', 'Status', 'Konstruksi Lama', 'Konstruksi Bongkar', 'Lat', 'Lng'],
    ...p.points.map((x, i) => [i + 1, x.nomor, x.kodeManual || x.kode, x.sudut, x.jenisTiang, x.peralatan, x.konduktor, i ? sp[i - 1] : 0, x.kondisi, x.konsLama, x.konsBongkar, x.lat, x.lng]),
    [], ['Penyeberangan'], ...p.crossings.map((c) => [c.type, c.label, c.tinggi ? c.tinggi + ' m' : '', c.lat, c.lng]), [],
    ['Digambar', p.meta.digambar], ['Diperiksa', p.meta.diperiksa], ['Diketahui', p.meta.diketahui], ['Disetujui', p.meta.disetujui],
  ]), 'GAMBAR')
  const R = hitungRab(p), { rows } = R
  const r = [['PT PLN (PERSERO) UP3 KLATEN'], ['RENCANA ANGGARAN BIAYA (RAB)'], ['PEKERJAAN', ':', `${p.jenis === 'Tambah Daya' ? 'TD' : 'PB'} ${p.nama.toUpperCase()}`], ['LOKASI', ':', p.lokasi], ['ANGGARAN', ':', `INVESTASI TAHUN ${new Date().getFullYear()} - asal material: ${p.rabOpt.asal}`], [],
    ['NO', 'URAIAN', 'GOL', 'SAT', 'VOL', 'HARGA SATUAN', 'MDU', 'HARDWARE', 'JASA', 'JUMLAH']]
  rows.forEach((k) => {
    r.push([k.kelompok, k.judul]); let last = null, n = 0
    k.items.forEach((i, idx) => {
      if (i.konstruksi && i.konstruksi !== last) { last = i.konstruksi; n = 0; r.push(['+', i.konstruksi, '', '', '', i.unit ? i.unit + ' Unit' : '']) }
      n++; r.push([i.konstruksi ? n : idx + 1, i.nama, i.gol, i.sat, i.vol, i.price ?? '', i.mdu, i.hardware, i.jasa, i.total ?? ''])
    })
  })
  if (R.slo) r.push([1, 'Sertifikasi Laik Operasi', 'JASA', 'Lot', 1, '2,5%', '', '', R.slo.jumlah, R.slo.jumlah])
  const sm = (l, v) => r.push(['', l + ' :', '', '', '', '', v.mdu, v.hardware, v.jasa, v.total])
  sm('Jumlah MDU - Hardware - Jasa', R.sub); sm(`PPN ${Math.round(R.pctPpn * 100)}%`, R.ppn); sm('Jumlah Total', R.jum)
  r.push([], ['', `Terbilang : ( ${R.terbilang} )`], ['', `Harga yang dipakai adalah ${p.rabOpt.harga} 2024`])
  const ws = XLSX.utils.aoa_to_sheet(r); ws['!cols'] = [{ wch: 5 }, { wch: 60 }, { wch: 7 }, { wch: 6 }, { wch: 8 }, { wch: 14 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 17 }]
  XLSX.utils.book_append_sheet(wb, ws, 'RAB')
  XLSX.writeFile(wb, `${p.nomor}_${p.nama.replace(/\s+/g, '_')}.xlsx`)
}
