import { hitungRab as hitung, spans } from './shared/rab.js'
import { getKons, materialMap } from './konstruksi'

export { spans }
// Hitungan di perangkat (dipakai saat offline); server memakai fungsi yang sama dari folder shared/
export function hitungRab(project) {
  const m = materialMap()
  return hitung(project, { getKons: (k, g) => getKons(k, g), tiang: m, konduktor: m, peralatan: m })
}

// Item RAB yang harganya masih kosong/Rp0 (PRD F6): ekspor dikunci sampai diisi lewat kolom "Edit harga".
export function rabKosong(hasil) {
  const out = []
  for (const k of hasil.rows) for (const i of k.items) if (i.price == null || i.price === 0) out.push({ kelompok: k.kelompok, nama: i.nama })
  return out
}
