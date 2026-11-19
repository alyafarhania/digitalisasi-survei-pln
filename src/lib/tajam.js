// Belokan tajam = sudut DALAM antara dua segmen < 90° (garis hampir berbalik arah).
// p.sudut menyimpan sudut belokan (0° = lurus, dipakai nama kode konstruksi), jadi sudut dalam = 180° - p.sudut.
export const BATAS_SUDUT_DALAM = 90
export const sudutDalam = (p) => 180 - (p.sudut ?? 0)
export const isTajamPoint = (_project, p) => sudutDalam(p) < BATAS_SUDUT_DALAM
