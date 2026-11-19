import { api } from './api'

// Data master dari server (PostgreSQL), disimpan di perangkat supaya tetap ada saat offline.
export const MASTER = { konstruksi: [], tiang: [], peralatan: [], konduktor: [], simbol: [], aturan: [], tarif: ['R1', 'R2', 'R3', 'B1', 'B2', 'B3', 'I1', 'I2', 'I3', 'I4', 'P1', 'P2', 'P3'], at: null }
export const GRUP_JALUR = [
  'KONSTRUKSI JTM 3 FASA PADA TIANG BETON', 'KONSTRUKSI JTM 3 FASA PADA TIANG BESI',
  'KONSTRUKSI JTM 1 FASA PADA TIANG BETON', 'KONSTRUKSI JTM 1 FASA PADA TIANG BESI', 'SKUTM',
]
const KEY = 'pln-master-v2'
let idx = new Map(), byName = {}
function index() {
  idx = new Map(MASTER.konstruksi.map((k) => [k.kode + '|' + k.grup, k]))
  byName = {}
  ;[...MASTER.tiang, ...MASTER.peralatan, ...MASTER.konduktor].forEach((m) => (byName[m.nama] = m))
}
export const materialMap = () => byName
export const masterReady = () => MASTER.konstruksi.length > 0

export async function loadMaster() {
  let fresh = false
  try {
    Object.assign(MASTER, await api.get('/api/master', { timeout: 20000 })); fresh = true
    try { localStorage.setItem(KEY, JSON.stringify(MASTER)) } catch { /* kuota penuh */ }
  } catch {
    try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c) Object.assign(MASTER, c) } catch { /* abaikan */ }
  }
  index()
  return { ok: masterReady(), fresh }
}

export const getKons = (kode, grup) => idx.get(kode + '|' + grup) || MASTER.konstruksi.find((k) => k.kode === kode)
export const maxSudut = (grup) => Math.max(0, ...MASTER.konstruksi.filter((k) => k.grup === grup && k.smax != null).map((k) => k.smax))
// Pilih kode otomatis dari sudut belokan (rentang dibaca dari nama kode di KONSTRUKSI)
export function pickKode(sudut, grup) {
  const c = MASTER.konstruksi.filter((k) => k.grup === grup && k.smin != null && !/['\-]/.test(k.kode))
  const hit = c.find((k) => sudut >= k.smin && sudut <= k.smax) || c.find((k) => sudut === 0)
  return hit ? hit.kode : null
}
export const kodeList = (grup) => MASTER.konstruksi.filter((k) => k.grup === grup).map((k) => k.kode)
