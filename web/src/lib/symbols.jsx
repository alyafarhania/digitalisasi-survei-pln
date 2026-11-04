// Simbol gambar. Ikon diambil dari tabel `simbol` di server (cadangan: shared/symbols.js).
// Merah = Baru, ungu tua = Eksisting, abu-abu = Bongkar (placeholder).
import { SIMBOL, symMarkup, matchAturan, ATURAN, garisSimbol, colorOfStatus } from '@shared/symbols.js'
import { MASTER } from './konstruksi'

export { C_BARU, C_EKS, C_BONGKAR } from '@shared/symbols.js'
export const statusOf = (kondisi) => ({ Baru: 'baru', Eksisting: 'eksisting', Bongkar: 'bongkar' }[kondisi] || 'baru')
export const colorOf = (kondisi) => colorOfStatus(statusOf(kondisi))
export const LEGEND = SIMBOL.map(([k, n]) => [n, k])
const NAMA = Object.fromEntries(SIMBOL.map(([k, n]) => [k, n]))

const cache = new Map()
const inner = (t, s) => {
  const key = t + s + (MASTER.at || '')
  if (cache.has(key)) return cache.get(key)
  const row = MASTER.simbol.find((x) => x.kode === t)
  const svg = row?.['ikon_' + s]
  const out = svg ? svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') : symMarkup(t, s)
  cache.set(key, out); return out
}
const aturan = () => (MASTER.aturan.length ? MASTER.aturan : ATURAN.map(([sumber, pola, simbol, prioritas]) => ({ sumber, pola, simbol, prioritas })))

// Simbol utama titik: dari Jenis Peralatan bila ada, jika tidak dari Jenis Tiang
export const equipSym = (p) => matchAturan(aturan(), 'peralatan', p.peralatan)
export const symOfPoint = (p) => equipSym(p) || matchAturan(aturan(), 'tiang', p.jenisTiang) || 'tiangBeton'
export const tiangSym = (p) => matchAturan(aturan(), 'tiang', p.jenisTiang) || 'tiangBeton'
export const jenisTitik = (p) => (equipSym(p) ? NAMA[equipSym(p)] : 'Tiang')
// Simbol tambahan dari kelompok konstruksi (vang net, schoor)
export const konsSym = (p, grup) => matchAturan(aturan(), 'konstruksi', `${p.konsBongkar ? '' : grup || ''}`) // dipakai bila kelompok konstruksi relevan
export const lineSymOf = (konduktor) => {
  const k = MASTER.konduktor.find((x) => x.nama === konduktor)
  return k ? garisSimbol(k.kelompok_garis, k.fasa) : 'jtm3'
}

export function Sym({ t, s = 'baru', x = 0, y = 0, k = 1 }) {
  return <g transform={`translate(${x},${y}) scale(${k})`} dangerouslySetInnerHTML={{ __html: inner(t, s) }} />
}
export const SymInline = ({ t, s = 'baru', w = 54, h = 20 }) => (
  <svg width={w} height={h} viewBox="-27 -10 54 20"><Sym t={t} s={s} /></svg>
)
export const symMarkupFor = inner
