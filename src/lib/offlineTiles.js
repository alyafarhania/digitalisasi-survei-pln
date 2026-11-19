// Penyimpanan tile peta untuk mode offline (IndexedDB) — jalan di HTTP maupun HTTPS, tanpa service worker.
const DB = 'pln-tiles', ST = 'tiles'
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(ST)
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
})
const tx = async (mode, fn) => {
  const db = await open()
  return new Promise((res, rej) => {
    const t = db.transaction(ST, mode), s = t.objectStore(ST), rq = fn(s)
    t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error)
  })
}
export const getTile = (url) => tx('readonly', (s) => s.get(url)).catch(() => null)
export const putTile = (url, blob) => tx('readwrite', (s) => s.put(blob, url)).catch(() => null)
export const countTiles = () => tx('readonly', (s) => s.count()).catch(() => 0)
export const clearTiles = () => tx('readwrite', (s) => s.clear()).catch(() => null)

// Dua tampilan peta: jalan (OpenStreetMap) dan satelit (Esri World Imagery).
// maxNative = zoom tertinggi yang ada gambarnya; di atas itu gambar diperbesar saja (maxZoom).
export const LAYERS = {
  peta: { nama: 'Peta', url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`, maxNative: 19, mb: 0.015,
    attr: '© OpenStreetMap contributors' },
  satelit: { nama: 'Satelit', url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`, maxNative: 19, mb: 0.03,
    attr: 'Tiles © Esri — Esri, Maxar, Earthstar Geographics, dan komunitas GIS' },
}
// Lapisan nama tempat (jalan, kampung, kantor, sekolah, dll.) yang ditempel di atas citra satelit.
export const LABEL = { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', maxNative: 19 }
export const getLabelPref = () => { try { return localStorage.getItem('pln-label') !== '0' } catch { return true } }
export const setLabelPref = (v) => { try { localStorage.setItem('pln-label', v ? '1' : '0') } catch { /* abaikan */ } }
export const MAX_ZOOM = 21
export const getLayerPref = () => { try { const v = localStorage.getItem('pln-layer'); return LAYERS[v] ? v : 'satelit' } catch { return 'satelit' } }
export const setLayerPref = (v) => { try { localStorage.setItem('pln-layer', v) } catch { /* abaikan */ } }

const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
const lat2y = (lat, z) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z)

// Zoom 15-17 mengikuti radius pilihan; zoom 18-19 (dekat sampai terlihat jalan dan atap) dibatasi 1 km
// supaya ukuran unduhan tetap wajar.
export const ZOOMS = [[15, Infinity], [16, Infinity], [17, Infinity], [18, 1000], [19, 1000]]
export function tileList(center, radiusM, layer = 'peta', zooms = ZOOMS) {
  const L = LAYERS[layer], urls = []
  for (const [z, cap] of zooms) {
    const r = Math.min(radiusM, cap)
    const dLat = r / 111320, dLng = r / (111320 * Math.cos((center.lat * Math.PI) / 180))
    const x0 = lon2x(center.lng - dLng, z), x1 = lon2x(center.lng + dLng, z), y0 = lat2y(center.lat + dLat, z), y1 = lat2y(center.lat - dLat, z)
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) urls.push(L.url(z, x, y))
  }
  return urls
}

// Unduh dengan antrean kecil (sopan terhadap server tile)
export async function downloadTiles(urls, onProgress, signal) {
  let done = 0, fail = 0
  const q = [...urls]
  const worker = async () => {
    while (q.length && !signal?.aborted) {
      const u = q.shift()
      try {
        if (!(await getTile(u))) {
          const r = await fetch(u)
          if (!r.ok) throw new Error('x')
          await putTile(u, await r.blob())
        }
      } catch { fail++ }
      done++; onProgress?.(done, urls.length, fail)
      await new Promise((r) => setTimeout(r, 40))
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return { done, fail }
}