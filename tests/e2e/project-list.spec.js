import { card, cards, createProject, expect, offlineFromStart, projectDoc, seed, test } from './fixtures'

const count = (page, f) => page.locator(`.qf-i.${f} b`)
test.describe('Daftar project', () => {
  test('kosong: ajakan membuat project pertama', async ({ page }) => {
    await seed(page, 'surveyor'); await page.goto('/'); await expect(page.getByText('Belum ada project di perangkat ini')).toBeVisible()
    await page.getByRole('button', { name: 'Buat project pertama' }).click(); await expect(page).toHaveURL('/project/baru')
  })
  test('formulir project baru: tombol aktif setelah nama & alamat terisi', async ({ page }) => {
    await seed(page, 'surveyor'); await page.goto('/project/baru'); const b = page.getByRole('button', { name: /Simpan & Lanjut/ })
    await expect(b).toBeDisabled(); await page.getByPlaceholder('Nama pelanggan').fill('PABRIK UJI'); await expect(b).toBeDisabled(); await page.getByPlaceholder(/^Alamat/).fill('Jl. Uji'); await expect(b).toBeEnabled()
  })
  test('placeholder memakai kata "contoh" (bukan "mis.")', async ({ page }) => {
    await seed(page, 'surveyor'); await page.goto('/project/baru'); await expect(page.getByPlaceholder('Nomor pekerjaan')).toBeVisible(); await expect(page.locator('input[placeholder^="mis."]')).toHaveCount(0)
  })
  test('project dibuat: kartu menampilkan pembuat dan terakhir diubah', async ({ page }) => {
    await seed(page, 'surveyor'); await createProject(page); await page.goto('/')
    await expect(card(page, 'PABRIK UJI')).toBeVisible(); const a = card(page, 'PABRIK UJI').locator('.paudit'); await expect(a).toContainText('Dibuat oleh'); await expect(a).toContainText('Agus Santoso'); await expect(a).toContainText('Terakhir diubah')
    await expect(a).not.toContainText('Difinalisasi')
  })
  test('filter cepat: setiap filter menampilkan jumlahnya dan menyaring daftar', async ({ page }) => {
    const ps = [projectDoc({ n: 1 }), projectDoc({ n: 2 }), projectDoc({ n: 3 }), projectDoc({ n: 4, status: 'Selesai', finalizedBy: { id: 'u-asman', name: 'Dewi Kartika', role: 'asman' }, finalizedAt: '2026-11-18T10:00:00.000Z' }), projectDoc({ n: 5, version: 0, dirty: true })]
    await offlineFromStart(page); await seed(page, 'asman', { projects: ps }); await page.goto('/')
    await expect(count(page, 'semua')).toHaveText('5'); await expect(count(page, 'draft')).toHaveText('4'); await expect(count(page, 'final')).toHaveText('1'); await expect(count(page, 'sinkron')).toHaveText('4'); await expect(count(page, 'belum')).toHaveText('1')
    await page.locator('.qf-i.final').click(); await expect(cards(page)).toHaveCount(1); await expect(page).toHaveURL(/status=final/)
    await page.locator('.qf-i.belum').click(); await expect(cards(page)).toHaveCount(1); await expect(card(page, 'PABRIK UJI 5')).toBeVisible()
    await page.locator('.qf-i.draft').click(); await expect(cards(page)).toHaveCount(4)
    await page.locator('.qf-i.draft').click(); await expect(cards(page)).toHaveCount(5) // klik lagi = kembali ke semua
  })
  test('pencarian: nama/nomor/lokasi, hapus (×), dan hasil kosong', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [1, 2, 3].map((n) => projectDoc({ n })) }); await page.goto('/')
    const s = page.getByRole('searchbox', { name: 'Cari project' }); await s.fill('UJI 3'); await expect(cards(page)).toHaveCount(1); await expect(page.locator('.resultline')).toContainText('Menampilkan 1 dari 3')
    await page.getByRole('button', { name: 'Hapus pencarian' }).click(); await expect(cards(page)).toHaveCount(3); await expect(s).toHaveValue('')
    await s.fill('PB-2026-002'); await expect(cards(page)).toHaveCount(1)
    await s.fill('zzzz tidak ada'); await expect(page.getByText('Tidak ada project yang cocok')).toBeVisible(); await page.getByRole('button', { name: 'Reset filter' }).click(); await expect(cards(page)).toHaveCount(3)
  })
  test('urutkan: nama A–Z, daya tertinggi, terlama, nomor', async ({ page }) => {
    const ps = [projectDoc({ n: 1, nama: 'Zulkifli', daya: 1300 }), projectDoc({ n: 2, nama: 'Andi', daya: 99000 }), projectDoc({ n: 3, nama: 'Budi', daya: 5500 })]
    await seed(page, 'surveyor', { projects: ps }); await page.goto('/'); const first = () => cards(page).first().locator('h3'); const sort = page.getByLabel('Urutkan project')
    await expect(first()).toContainText('Zulkifli') // terakhir diubah = n 1
    await sort.selectOption('nama'); await expect(first()).toContainText('Andi'); await expect(page).toHaveURL(/sort=nama/)
    await sort.selectOption('daya'); await expect(first()).toContainText('Andi')
    await sort.selectOption('lama'); await expect(first()).toContainText('Budi') // n 3 paling lama
    await sort.selectOption('nomor'); await expect(first()).toContainText('Zulkifli') // PB-2026-001
  })
  test('muat bertahap (infinite scroll): 10 → seterusnya → semua', async ({ page }) => {
    await seed(page, 'surveyor', { projects: Array.from({ length: 35 }, (_, i) => projectDoc({ n: i + 1 })) }); await page.goto('/')
    await expect(cards(page)).toHaveCount(10)
    for (const n of [20, 30, 35]) { await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await expect(cards(page)).toHaveCount(n, { timeout: 8000 }) }
    await expect(page.getByText('Semua 35 project sudah ditampilkan')).toBeVisible()
  })
  test('urutan/filter/pencarian dipulihkan dari URL', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [1, 2].map((n) => projectDoc({ n })) }); await page.goto('/?sort=nama&status=draft&q=uji')
    await expect(page.getByLabel('Urutkan project')).toHaveValue('nama'); await expect(page.locator('.qf-i.draft')).toHaveAttribute('aria-pressed', 'true'); await expect(page.getByRole('searchbox', { name: 'Cari project' })).toHaveValue('uji')
  })
  test('hapus memakai pop-up aplikasi (bukan alert browser) dan bisa dibatalkan', async ({ page }) => {
    let dialog = false; page.on('dialog', (d) => { dialog = true; d.dismiss() })
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto('/'); await page.getByRole('button', { name: /Hapus project PB-2026-001/ }).click()
    const m = page.locator('.modal'); await expect(m).toContainText('Hapus project ini?'); await expect(m).toContainText('tidak dapat dibatalkan'); await expect(m).toContainText('PB-2026-001')
    await m.getByRole('button', { name: 'Batal' }).click(); await expect(m).toHaveCount(0); await expect(cards(page)).toHaveCount(1)
    await page.getByRole('button', { name: /Hapus project/ }).click(); await page.locator('.modal').getByRole('button', { name: 'Ya, hapus project' }).click()
    await expect(cards(page)).toHaveCount(0); await expect(page.getByText('Belum ada project')).toBeVisible(); expect(dialog).toBe(false)
  })
  test('hapus project dengan perubahan belum tersinkron memberi peringatan tambahan', async ({ page }) => {
    await offlineFromStart(page); await seed(page, 'surveyor', { projects: [projectDoc({ version: 0, dirty: true })] }); await page.goto('/'); await page.getByRole('button', { name: /Hapus project/ }).click()
    await expect(page.locator('.modal')).toContainText('belum tersinkron')
  })
  test('buka project dengan kode: saran "Buka project dengan kode" dan hasil server', async ({ page }) => {
    const remote = projectDoc({ n: 9, kode: 'remote0009x2', nama: 'PROYEK DI SERVER' })
    await seed(page, 'surveyor', { projects: [projectDoc()], server: [remote] }); await page.goto('/'); const s = page.getByRole('searchbox', { name: 'Cari project' })
    await s.fill('remote0009x2'); await expect(page.locator('.codehit')).toContainText('remote0009x2'); await page.locator('.codehit').click()
    await expect(page).toHaveURL(/\/project\/remote0009x2\/data/); await expect(page.locator('.stepmeta-t b')).toContainText('PROYEK DI SERVER')
  })
  test('pencarian menemukan project yang hanya ada di server', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()], server: [projectDoc({ n: 9, kode: 'remote0009x2', nama: 'PROYEK DI SERVER' })] }); await page.goto('/')
    await page.getByRole('searchbox', { name: 'Cari project' }).fill('DI SERVER'); await expect(page.getByText('Ditemukan di server')).toBeVisible(); await expect(card(page, 'PROYEK DI SERVER')).toBeVisible()
  })
  test('"Lanjutkan" membuka langkah pertama yang belum lengkap', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc({ guide: {} })] }); await page.goto('/')
    await expect(page.getByRole('button', { name: /Lanjutkan: Peta/ })).toBeVisible(); await page.getByRole('button', { name: /Lanjutkan: Peta/ }).click(); await expect(page).toHaveURL(/\/peta$/)
  })
  test('kartu menampilkan progres langkah', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto('/'); await expect(card(page, 'PABRIK UJI 1')).toContainText('5/5 langkah')
  })
})
