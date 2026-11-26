import { hitungRab, rabKosong } from './rab'
import { isTajamPoint } from './tajam'

// Lima langkah kerja, berurutan. `ready` = langkah boleh dibuka; `done` = syarat langkah terpenuhi; `todo` = yang masih kurang.
export const STEPS = [
  { key: 'data', no: 1, label: 'Data Pelanggan', short: 'Data', icon: 'sheet' },
  { key: 'peta', no: 2, label: 'Peta & Tagging', short: 'Peta', icon: 'pin' },
  { key: 'gambar', no: 3, label: 'Gambar Skematik', short: 'Gambar', icon: 'poles' },
  { key: 'rab', no: 4, label: 'Material & RAB', short: 'RAB', icon: 'sheet' },
  { key: 'ekspor', no: 5, label: 'Foto & Ekspor', short: 'Ekspor', icon: 'download' },
]
export const stepIndex = (key) => STEPS.findIndex((s) => s.key === key)

export function stepStatus(p) {
  if (!p) return Object.fromEntries(STEPS.map((s, i) => [s.key, { ready: i === 0, done: false, todo: i === 0 ? ['Isi data pelanggan'] : ['Buat project dulu'] }]))
  const n = p.points?.length || 0, m = p.meta || {}
  const todoData = [!p.nama?.trim() && 'nama pelanggan', !p.nomor?.trim() && 'nomor pekerjaan', !p.lokasi?.trim() && 'alamat', !(p.daya > 0) && 'daya'].filter(Boolean)
  const kosong = n >= 2 ? rabKosong(hitungRab(p)).length : 0
  const tajam = (p.points || []).filter((x) => isTajamPoint(p, x)).length
  const todoGambar = [n < 2 && 'minimal 2 titik', !m.noGambar && 'No. Gambar', !m.digambar && 'nama penggambar'].filter(Boolean)
  const st = {
    data: { ready: true, done: !todoData.length, todo: todoData.length ? [`Lengkapi: ${todoData.join(', ')}`] : [] },
    peta: { ready: true, done: n >= 2, todo: n >= 2 ? [] : [`Tandai minimal 2 titik (baru ${n})`], warn: tajam ? `${tajam} belokan tajam (sudut dalam < 90°)` : null },
    gambar: { ready: n >= 2, done: !todoGambar.length, todo: todoGambar.length ? [`Lengkapi: ${todoGambar.join(', ')}`] : [] },
    rab: { ready: n >= 2, done: n >= 2 && !kosong, todo: kosong ? [`${kosong} harga masih kosong`] : n < 2 ? ['Tandai titik dulu'] : [] },
    ekspor: { ready: n >= 2, done: n >= 2 && !kosong && (p.foto?.length || 0) > 0, todo: [kosong && 'Isi harga RAB', !(p.foto?.length) && 'Tambah foto lokasi'].filter(Boolean) },
  }
  for (const k of Object.keys(st)) {
    const kurang = manualKurang(k, p)
    if (st[k].done && kurang.length) { st[k].done = false; st[k].todo = [`Centang: ${kurang[0].t}`] }
  }
  // Berurutan: langkah baru bisa dibuka bila semua langkah sebelumnya lengkap
  let terkunci = false
  for (const s of STEPS) {
    if (terkunci) { st[s.key].ready = false; st[s.key].todo = ['Selesaikan langkah sebelumnya dulu'] }
    if (!st[s.key].done) terkunci = true
  }
  return st
}

// Panduan tiap langkah. Setiap butir bisa dicoret:
//  - otomatis (auto): selesai bila datanya terpenuhi (tidak bisa dicentang manual)
//  - manual: dicentang pengguna, atau otomatis oleh aksi terkait (mis. tombol Selesai). Disimpan di project.guide
// opsional = tidak menghalangi langkah dianggap lengkap.
export function stepGuide(key, p) {
  const n = p?.points?.length || 0, m = p?.meta || {}, pts = p?.points || []
  const g = p?.guide || {}
  const A = (id, t, done, extra = {}) => ({ id, t, auto: true, done: !!p && !!done, ...extra })
  const M = (id, t, extra = {}) => ({ id, t, auto: false, done: !!g[`${key}:${id}`], ...extra })
  const has = (v) => !!String(v ?? '').trim()
  const kosong = p && n >= 2 ? rabKosong(hitungRab(p)).length : 1
  const tajam = p ? pts.filter((x) => isTajamPoint(p, x)).length : 1
  const G = {
    data: { title: 'Isi data pelanggan', intro: 'Data ini muncul di kotak judul gambar dan kepala RAB.', tip: 'Nomor pekerjaan mengikuti penomoran kantor dan diisi manual.', items: [
      A('nama', 'Nama calon pelanggan', has(p?.nama)), A('jenis', 'Jenis pekerjaan: Pasang Baru atau Tambah Daya', has(p?.jenis)),
      A('nomor', 'Nomor pekerjaan', has(p?.nomor)), A('alamat', 'Alamat / lokasi pekerjaan', has(p?.lokasi)),
      A('daya', 'Golongan tarif dan daya', p?.daya > 0), A('feeder', 'Feeder, gardu induk, sub sistem', has(m.feeder) || has(m.gi) || has(m.subsistem), { opsional: true }),
    ] },
    peta: { title: 'Tandai jalur di peta', intro: 'Tandai tiang satu per satu dari sumber listrik ke lokasi pelanggan.', tip: 'Tidak ada sinyal? Unduh area peta, atau unggah peta offline (mis. Satplant) dari galeri lewat tombol di atas peta.', items: [
      M('mulai', 'Cari lokasi atau pakai GPS, lalu tekan Mulai', { opsional: true }),
      A('titik', 'Ketuk peta untuk menaruh titik tiang (minimal 2)', n >= 2),
      A('atribut', 'Isi jenis tiang dan konduktor tiap titik', n > 0 && pts.every((x) => x.jenisTiang && x.konduktor)),
      A('nomor', 'Beri nomor tiang tiap titik', n > 0 && pts.every((x) => x.nomor)),
      M('jtr', 'Tambah konstruksi JTR pada tiang eksisting bila ada (satu titik bisa banyak konstruksi)', { opsional: true }),
      A('sudut', 'Tidak ada belokan tajam (sudut dalam < 90°)', n > 0 && tajam === 0),
      M('silang', 'Tandai jalan, sungai, atau SUTT yang disilang', { opsional: true }),
      M('selesai', 'Tekan Selesai bila tagging sudah lengkap'),
    ] },
    gambar: { title: 'Periksa gambar skematik', intro: 'Gambar dibuat otomatis dari titik di peta. Cek lalu lengkapi kotak judul.', tip: 'Kotak keterangan yang menumpuk bisa digeser dengan jari/mouse.', items: [
      M('cek', 'Gambar terbaca jelas, kotak tidak bertabrakan'), A('noGambar', 'Isi No. Gambar', has(m.noGambar)), A('digambar', 'Isi nama penggambar (Digambar)', has(m.digambar)),
      A('ttd', 'Isi Diperiksa, Diketahui, Disetujui', has(m.diperiksa) || has(m.diketahui) || has(m.disetujui), { opsional: true }), M('png', 'Unduh PNG bila perlu', { opsional: true }),
    ] },
    rab: { title: 'Periksa material dan RAB', intro: 'Material dan jasa dihitung otomatis dari konstruksi tiap titik.', tip: 'Harga kosong tampil merah. Ketik harga di kolom Harga satuan agar ekspor terbuka.', items: [
      M('opsi', 'Periksa pilihan harga (HSS/KHS), jenis RAB, dan asal material'),
      A('harga', 'Semua item punya harga', n >= 2 && !kosong), M('slo', 'SLO 2,5% sesuai kebutuhan', { opsional: true }),
    ] },
    ekspor: { title: 'Foto dan ekspor', intro: 'Lampirkan foto lokasi lalu unduh Excel (sheet GAMBAR dan RAB).', tip: 'Bagikan link project agar rekan bisa membukanya di laptop.', items: [
      A('harga', 'Semua harga RAB terisi', n >= 2 && !kosong), A('foto', 'Tambah foto lokasi', (p?.foto?.length || 0) > 0),
      M('unduh', 'Unduh Excel (.xlsx)'), M('link', 'Salin link project untuk dibagikan', { opsional: true }),
    ] },
  }
  return G[key]
}

// Butir manual wajib yang belum dicentang pada satu langkah
export const manualKurang = (key, p) => (stepGuide(key, p)?.items || []).filter((x) => !x.auto && !x.opsional && !x.done)
