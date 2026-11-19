// Penyimpanan foto lokasi di perangkat (IndexedDB). Foto tidak disimpan di localStorage (batas ±5 MB).
// Mode mock memakai penyimpanan yang sama sebagai "server"; mode live mengambil dari /api/foto/:id bila tidak ada di perangkat.
const DB = 'pln-foto', ST = 'foto'
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(ST)
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
})
const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(ST, mode), rq = fn(t.objectStore(ST)); t.oncomplete = () => res(rq?.result); t.onerror = () => rej(t.error) }) }
export const fotoPut = (id, blob) => tx('readwrite', (s) => s.put(blob, id))
export const fotoGet = (id) => tx('readonly', (s) => s.get(id)).catch(() => null)
export const fotoDel = (id) => tx('readwrite', (s) => s.delete(id)).catch(() => null)

// Perkecil foto kamera (maks 1600 px, JPEG 82%) agar ringan dikirim lewat jaringan seluler
export async function kompresFoto(file, maks = 1600, mutu = 0.82) {
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, maks / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', mutu))
    return blob && blob.size < file.size ? blob : file
  } catch { return file }
}
