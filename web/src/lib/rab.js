import { hitungRab as hitung, spans } from '@shared/rab.js'
import { getKons, materialMap } from './konstruksi'

export { spans }
// Hitungan di perangkat (dipakai saat offline); server memakai fungsi yang sama dari folder shared/
export function hitungRab(project) {
  const m = materialMap()
  return hitung(project, { getKons: (k, g) => getKons(k, g), tiang: m, konduktor: m, peralatan: m })
}
