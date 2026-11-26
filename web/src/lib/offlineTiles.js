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

export const TILE_URL = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
const lat2y = (lat, z) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z)

export function tileList(center, radiusM, zooms = [15, 16, 17]) {
  const dLat = radiusM / 111320, dLng = radiusM / (111320 * Math.cos((center.lat * Math.PI) / 180))
  const urls = []
  for (const z of zooms) {
    const x0 = lon2x(center.lng - dLng, z), x1 = lon2x(center.lng + dLng, z), y0 = lat2y(center.lat + dLat, z), y1 = lat2y(center.lat - dLat, z)
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) urls.push(TILE_URL(z, x, y))
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
