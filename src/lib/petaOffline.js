// Peta offline unggahan (mis. peta Satplant dari galeri). Gambarnya disimpan di perangkat (IndexedDB, bukan localStorage
// yang hanya ±5 MB); data pengaturannya (ukuran piksel, lebar area, titik pusat) ikut tersimpan di project:
//   project.petaOffline = { id, name, w, h, widthM, center: { lat, lng }, aktif }
// Gambar dianggap menghadap utara dan diletakkan di sekitar `center` dengan lebar `widthM` meter. Titik tagging tetap
// berupa lat/lng biasa, jadi jarak, panjang penghantar, dan RAB tidak berubah cara hitungnya.
import { useEffect, useState } from 'react'

const DB = 'pln-peta-offline', ST = 'peta'
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(ST)
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
})
const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(ST, mode), rq = fn(t.objectStore(ST)); t.oncomplete = () => res(rq?.result); t.onerror = () => rej(t.error) }) }
export const petaPut = (id, blob) => tx('readwrite', (s) => s.put(blob, id))
export const petaGet = (id) => tx('readonly', (s) => s.get(id)).catch(() => null)
export const petaDel = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => null)

export const LEBAR_AWAL_M = 400
export const KLATEN = { lat: -7.7059, lng: 110.6016 }
const M_LAT = 110574, M_LNG = 111320

// Perkecil gambar (maks 2400 px, JPEG) supaya ringan disimpan dan tetap tajam saat dicetak/diekspor.
export async function siapkanGambar(file, maks = 2400, mutu = 0.88) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, maks / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k))
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(bmp, 0, 0, w, h)
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', mutu))
  if (!blob) throw new Error('Gagal membaca gambar')
  return { blob, w, h }
}

export const buatPetaOffline = (file, { w, h }, center, widthM = LEBAR_AWAL_M) => ({
  id: crypto.randomUUID(), name: file.name || 'peta-offline', w, h, widthM, center: { lat: center.lat, lng: center.lng }, aktif: true,
})

// Setengah lebar/tinggi gambar dalam derajat
const half = (po) => {
  const hm = (po.widthM * po.h) / po.w
  return { dLat: hm / 2 / M_LAT, dLng: po.widthM / 2 / (M_LNG * Math.cos((po.center.lat * Math.PI) / 180)) }
}
// Batas gambar di peta: [[selatan, barat], [utara, timur]]
export function boundsOf(po) {
  const { dLat, dLng } = half(po), c = po.center
  return [[c.lat - dLat, c.lng - dLng], [c.lat + dLat, c.lng + dLng]]
}
// Titik lat/lng -> pecahan posisi pada gambar (0..1, kiri-atas = 0,0)
export function keGambar(po, ll) {
  const { dLat, dLng } = half(po), c = po.center
  return { fx: (ll.lng - (c.lng - dLng)) / (2 * dLng), fy: (c.lat + dLat - ll.lat) / (2 * dLat) }
}

// Ubah lebar area (skala) atau pindah pusat gambar; titik dan penyeberangan yang sudah ditandai ikut bergeser
// supaya tetap berada di posisi yang sama pada gambar.
export function ubahPeta(project, patch) {
  const po = project.petaOffline, baru = { ...po, ...patch }
  const f = baru.widthM / po.widthM, dLat = baru.center.lat - po.center.lat, dLng = baru.center.lng - po.center.lng
  const geser = (q) => ({ ...q, lat: baru.center.lat + (q.lat - po.center.lat) * f, lng: baru.center.lng + (q.lng - po.center.lng) * f })
  const ubah = f !== 1 || dLat !== 0 || dLng !== 0
  return { ...project, petaOffline: baru, points: ubah ? project.points.map(geser) : project.points, crossings: ubah ? project.crossings.map(geser) : project.crossings }
}

// Alamat gambar untuk <img>/<image>. null selama belum terbaca (atau gambar tidak ada di perangkat ini).
export function useGambarPeta(po) {
  const [url, setUrl] = useState(null), [hilang, setHilang] = useState(false)
  const id = po?.id
  useEffect(() => {
    let hidup = true, o = null
    setUrl(null); setHilang(false)
    if (!id) return
    petaGet(id).then((b) => { if (!hidup) return; if (!b) return setHilang(true); o = URL.createObjectURL(b); setUrl(o) })
    return () => { hidup = false; o && URL.revokeObjectURL(o) }
  }, [id])
  return { url, hilang }
}
// Untuk ekspor (PNG/Excel): gambar sebagai data URL
export async function petaDataUrl(po) {
  if (!po?.id) return null
  const b = await petaGet(po.id); if (!b) return null
  return new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = () => res(null); f.readAsDataURL(b) })
}
// Peta offline yang dipakai pada project (aktif) — dasar untuk latar gambar
export const petaAktif = (p) => (p?.petaOffline?.aktif ? p.petaOffline : null)
