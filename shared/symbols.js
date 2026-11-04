// Sumber tunggal simbol gambar (legenda sheet GAMBAR). Dipakai server (mengisi tabel simbol)
// dan web (cadangan jika data simbol dari server belum ada).
export const C_BARU = '#E31E24'     // Baru = merah
export const C_EKS = '#3B1D6E'      // Eksisting = ungu tua (permintaan pengguna)
export const C_BONGKAR = '#8A8F98'  // Bongkar = abu-abu (placeholder, PRD: bentuk belum ditentukan)
export const C_NET = '#1D6FD6'
export const colorOfStatus = (s) => (s === 'baru' ? C_BARU : s === 'eksisting' ? C_EKS : C_BONGKAR)

// [kode, nama, geometri]
export const SIMBOL = [
  ['tiangBeton', 'Tiang Beton', 'titik'], ['tiangBesi', 'Tiang Besi', 'titik'], ['jtm3', 'JTM 3 Fasa', 'garis'],
  ['jtm1', 'JTM 1 Fasa', 'garis'], ['jtr1', 'JTR 1 Fasa Only / UB', 'garis'], ['jtr3', 'JTR 3 Fasa Only / UB', 'garis'],
  ['trafo1', 'Trafo 1 Fasa', 'titik'], ['trafo3', 'Trafo 3 Fasa', 'titik'], ['fco', 'Fuse Cut Out', 'titik'],
  ['absw', 'ABSW', 'titik'], ['vang', 'Vang Net', 'garis'], ['schoor', 'Schoor', 'titik'], ['beton', 'Pembetonan Tiang', 'titik'],
]

// Isi SVG (pusat 0,0; simbol garis -22..22) untuk satu simbol dan satu status.
export function symMarkup(kode, status = 'baru') {
  const c = colorOfStatus(status), sw = 1.8
  const X = `<path d="M-4.6-4.6L4.6 4.6M4.6-4.6L-4.6 4.6" stroke="${c}" stroke-width="${sw}"/>`
  const slashes = (w) => [-7, 0, 7].map((a) => `<line x1="${a - 3}" y1="${w ? 5 : 4}" x2="${a + 3}" y2="${w ? -5 : -4}" stroke="${c}" stroke-width="1.4"/>`).join('')
  if (status === 'bongkar' && !['jtm3', 'jtm1', 'jtr1', 'jtr3', 'vang'].includes(kode))
    return `<circle r="7" fill="#fff" stroke="${c}" stroke-width="${sw}"/>${X}`
  switch (kode) {
    case 'tiangBeton': return `<circle r="7" fill="#fff" stroke="${c}" stroke-width="${sw}"/>${X}`
    case 'tiangBesi': return `<circle r="6" fill="${c}"/>`
    case 'jtm3': return `<line x1="-22" x2="22" stroke="${c}" stroke-width="2"${status === 'bongkar' ? ' stroke-dasharray="2 4"' : ''}/>`
    case 'jtm1': return `<line x1="-22" x2="22" stroke="${c}" stroke-width="2" stroke-dasharray="5 3"/>`
    case 'jtr1': return `<line x1="-22" x2="22" stroke="${c}" stroke-width="1.6"/>${slashes(false)}`
    case 'jtr3': return `<line x1="-22" x2="22" stroke="${c}" stroke-width="3.2"/>${slashes(true)}`
    case 'trafo1': return `<polygon points="0,-7 7,6 -7,6" fill="${c}"/>`
    case 'trafo3': return `<polygon points="0,-8 6,5 -6,5" fill="${c}"/><polygon points="-9,-2 -3,6 -15,6" fill="${c}"/><polygon points="9,-2 15,6 3,6" fill="${c}"/>`
    case 'fco': return `<path d="M-3-8L3-2L-3 1L3 8M3-8L-1-6" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>`
    case 'absw': return `<line x1="-22" x2="-3" stroke="${c}" stroke-width="2"/><line x1="-3" y1="-6" x2="-3" y2="6" stroke="${c}" stroke-width="2"/><line x1="3" y1="-6" x2="3" y2="6" stroke="${c}" stroke-width="2"/><line x1="3" x2="22" stroke="${c}" stroke-width="2"/>`
    case 'vang': return `<line x1="-22" x2="22" y1="-2" y2="-2" stroke="${C_NET}" stroke-width="2"/><line x1="-22" x2="22" y1="2.5" y2="2.5" stroke="${C_NET}" stroke-width="2"/>`
    case 'schoor': return `<line x1="-20" y1="6" x2="14" y2="-6" stroke="${c}" stroke-width="2"/><polygon points="20,-8 8,-9 12,1" fill="${c}"/>`
    case 'beton': return `<rect x="-7" y="-7" width="14" height="14" fill="#fff" stroke="${c}" stroke-width="${sw}"/><path d="M-7-7L7 7M7-7L-7 7" stroke="${c}" stroke-width="1.4"/>`
    default: return ''
  }
}
export const ikonSvg = (kode, status) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-27 -10 54 20" width="54" height="20">${symMarkup(kode, status)}</svg>`

// Aturan pemetaan atribut -> simbol (juga disimpan di tabel aturan_simbol)
export const ATURAN = [
  // [sumber, pola (regex, tidak peka huruf), simbol, prioritas]
  ['peralatan', '^Trafo 1', 'trafo1', 10], ['peralatan', '^Trafo (3|tiga)', 'trafo3', 10],
  ['peralatan', 'Fuse Cut|FCO|Cut ?Out', 'fco', 10], ['peralatan', 'ABSW', 'absw', 10],
  ['tiang', 'Besi', 'tiangBesi', 10], ['tiang', '.*', 'tiangBeton', 99],
  ['konstruksi', 'VANGNET', 'vang', 10],
  ['konstruksi', 'KAWAT TARIK', 'schoor', 10], // perlu dikonfirmasi (PRD)
]
export const matchAturan = (aturan, sumber, teks) => {
  const r = aturan.filter((a) => a.sumber === sumber).sort((a, b) => a.prioritas - b.prioritas)
  const hit = r.find((a) => new RegExp(a.pola, 'i').test(teks || ''))
  return hit ? hit.simbol : null
}
// garis dari konduktor: kelompok_garis 'JTM'|'JTR' dan jumlah fasa
export const garisSimbol = (kelompok, fasa) => (kelompok === 'JTR' ? (fasa === 1 ? 'jtr1' : 'jtr3') : fasa === 1 ? 'jtm1' : 'jtm3')
