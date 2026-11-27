import { test as base, expect } from '@playwright/test'

export const USERS = {
  asman: { id: 'u-asman', email: 'asman@pln.test', password: 'asman123', name: 'Bagus Prasetyo', role: 'asman', label: 'Asman/MULP' },
  surveyor: { id: 'u-surveyor', email: 'surveyor@pln.test', password: 'surveyor123', name: 'Agus Santoso', role: 'surveyor', label: 'Surveyor' },
  surveyor2: { id: 'u-surveyor2', email: 'surveyor2@pln.test', password: 'surveyor123', name: 'Siti Rahmawati', role: 'surveyor', label: 'Surveyor' },
}
const actor = (u) => ({ id: u.id, name: u.name, role: u.role })

// Dokumen project lengkap (semua langkah selesai) untuk diisi langsung ke penyimpanan
export function projectDoc(o = {}) {
  const by = actor(o.by || USERS.surveyor), n = o.n ?? 1, kode = o.kode || `kode${String(n).padStart(4, '0')}ab`
  const pt = (i, lat, lng) => ({ id: `${kode}-pt${i}`, lat, lng, nomor: `T${i + 1}`, jenisTiang: 'Tiang Beton 12M-350 daN+E', konduktor: 'AAAC 70 mm²', kondisi: 'Baru', peralatan: '', konsLama: '', konsBongkar: '', sudut: 0, kode: 'CC1' })
  const { by: _by, n: _n, ...rest } = o
  return {
    id: `id-${kode}`, kode, version: 1, dirty: false, localAt: Date.now() - n * 1000, nomor: `PB-2026-${String(n).padStart(3, '0')}`, nama: `PABRIK UJI ${n}`, jenis: 'Pasang Baru', lokasi: 'Jl. Uji, Klaten', tarif: 'R1', daya: 53000, status: 'Draft', tanggal: '2026-11-18',
    jalur: 'KONSTRUKSI JTM 3 FASA PADA TIANG BETON', points: [pt(0, -7.7059, 110.6012), pt(1, -7.7065, 110.6012), pt(2, -7.7071, 110.6012)], crossings: [],
    meta: { noGambar: '001/PLN/2026', skala: '1 : 2000', perihal: 'Pasang Baru', digambar: by.name, diperiksa: '', diketahui: '', disetujui: '' },
    rabOpt: { harga: 'HSS', jenis: 'Total', asal: 'Gudang UP3', slo: true }, priceEdits: {}, labelPos: {}, foto: [{ id: `${kode}-foto` }],
    guide: { 'peta:selesai': true, 'gambar:cek': true, 'rab:opsi': true, 'ekspor:unduh': true },
    createdBy: by, createdAt: '2026-11-18T08:00:00.000Z', lastEditedBy: by, lastEditedAt: '2026-11-18T09:30:00.000Z', audit: [{ id: `${kode}-a1`, action: 'created', by, at: '2026-11-18T08:00:00.000Z' }], ...rest,
  }
}

export const test = base.extend({
  // peta/pencarian eksternal dimatikan agar uji cepat, stabil, dan tidak butuh internet
  page: async ({ page }, use) => {
    await page.route(/(arcgisonline|openstreetmap|cartocdn|overpass|nominatim)/, (r) => r.abort())
    await use(page)
  },
})
export { expect }

// Masuk lewat halaman login (menguji alur sebenarnya)
export async function login(page, who, next = '/') {
  const u = USERS[who]
  await page.goto(next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`)
  await page.locator('input[type=email]').fill(u.email); await page.locator('input[type=password]').fill(u.password)
  await page.locator('button[type=submit]').click(); await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await expect(page.locator('.uchip')).toBeVisible()
}
// Sesi + data awal langsung diisi (cepat). Hanya diterapkan sekali per konteks.
export async function seed(page, who, { projects = [], server = [] } = {}) {
  const u = USERS[who], { password, label, ...session } = u
  await page.addInitScript(([s, st, srv]) => {
    if (localStorage.getItem('e2e-seeded')) return
    localStorage.setItem('pln-session-v1', JSON.stringify(s)); localStorage.setItem('pln-survey-v2', JSON.stringify({ projects: st, activeId: st[0]?.id || null }))
    if (srv.length) localStorage.setItem('pln-mock-server-v1', JSON.stringify({ projects: Object.fromEntries(srv.map((p) => [p.kode, { ...p, updatedAt: new Date().toISOString() }])) }))
    localStorage.setItem('e2e-seeded', '1')
  }, [session, projects, server])
}
// Pura-pura tanpa jaringan sejak awal (proyek berubah tetap "belum tersinkron")
// (salinan data master disiapkan dulu karena tanpa jaringan aplikasi hanya bisa memakai salinan perangkat)
export async function offlineFromStart(page) {
  const master = await (await page.request.get('/mock/master.json')).json()
  await page.addInitScript((m) => { localStorage.setItem('pln-master-v2', JSON.stringify({ ...m, simbol: [], aturan: [], at: new Date().toISOString() })); Object.defineProperty(navigator, 'onLine', { get: () => false }) }, master)
}
export const cards = (page) => page.getByTestId('project-card')
export const card = (page, text) => cards(page).filter({ hasText: text })
export const stepBtn = (page, n) => page.locator(`.step:nth-child(${n}) button`)
export const lanjut = (page) => page.locator('.stepfoot .btn').last()
export const guideItem = (page, text) => page.locator('.guide-d .gitem', { hasText: text })
export async function logout(page) { await page.locator('.uchip').click(); await page.getByRole('button', { name: 'Keluar' }).click(); await page.waitForURL(/\/login/) }

// Buat project baru lewat formulir; berakhir di langkah Peta
export async function createProject(page, { nama = 'PABRIK UJI', nomor = 'PB/2026/10/0053', alamat = 'Jl. Uji, Klaten', daya = '53000' } = {}) {
  await page.goto('/project/baru')
  await page.getByPlaceholder('Nama pelanggan').fill(nama); await page.getByPlaceholder('Nomor pekerjaan').fill(nomor); await page.getByPlaceholder(/^Alamat/).fill(alamat); await page.getByPlaceholder('Daya baru').fill(daya)
  await page.getByRole('button', { name: /Simpan & Lanjut/ }).click(); await page.waitForURL(/\/project\/[\w-]+\/peta$/)
  return page.url().match(/\/project\/([\w-]+)\//)[1]
}
// Ketuk peta untuk menaruh titik (Mulai dulu). Posisi diukur ulang tiap ketukan dan panel atribut ditutup lewat DOM
// (tanpa menggulir halaman) supaya stabil di layar kecil.
export async function tagPoints(page, n = 2) {
  await page.locator('.map-bar button', { hasText: 'Mulai' }).click()
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => window.scrollTo(0, 0))
    const box = await page.locator('.rmap .leaflet-container').boundingBox()
    await page.mouse.click(box.x + box.width * (0.42 + i * 0.1), box.y + box.height * (0.5 + i * 0.05)); await page.waitForTimeout(250)
    await page.evaluate(() => document.querySelector('.atr-x')?.click())
  }
}
