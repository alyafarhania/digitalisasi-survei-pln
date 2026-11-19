import { expect, projectDoc, seed, test } from './fixtures'

const png = (name) => ({ name, mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC', 'base64') })
const thumbs = (page) => page.locator('.photos .ph:not(.add)')
const open = async (page, who = 'surveyor', over = { foto: [] }) => { await seed(page, who, { projects: [projectDoc(over)] }); await page.goto('/project/kode0001ab/ekspor'); await expect(page.getByTestId('photos')).toBeVisible() }
const rendered = (loc) => loc.locator('img').evaluate((i) => i.complete && i.naturalWidth > 0)
test.describe('Foto lokasi', () => {
  test('unggah foto: pratinjau tampil (tidak rusak) dan jumlah foto bertambah', async ({ page }) => {
    await open(page); await expect(page.locator('.card-h', { hasText: 'Foto lokasi' })).toContainText('0 foto')
    await page.setInputFiles('input[type=file]', png('a.png')); await expect(thumbs(page)).toHaveCount(1); await expect(page.locator('.card-h', { hasText: 'Foto lokasi' })).toContainText('1 foto')
    await expect.poll(() => rendered(thumbs(page).first())).toBe(true)
  })
  test('foto tetap ada dan tampil setelah reload (disimpan di perangkat)', async ({ page }) => {
    await open(page); await page.setInputFiles('input[type=file]', png('a.png')); await expect(thumbs(page)).toHaveCount(1); await page.waitForTimeout(800); await page.reload()
    await expect(thumbs(page)).toHaveCount(1); await expect.poll(() => rendered(thumbs(page).first())).toBe(true)
  })
  test('foto terunggah ke server tiruan (tidak lagi "Menunggu")', async ({ page }) => {
    await open(page); await page.setInputFiles('input[type=file]', png('a.png')); await expect(thumbs(page)).toHaveCount(1); await expect(page.locator('.ph-badge')).toHaveCount(0, { timeout: 8000 })
  })
  test('klik foto membuka pratinjau besar (pop over) dengan keterangan', async ({ page }) => {
    await open(page); await page.setInputFiles('input[type=file]', png('lokasi-1.png')); await expect(thumbs(page)).toHaveCount(1); await thumbs(page).first().click()
    const lb = page.getByRole('dialog', { name: /Foto lokasi 1 dari 1/ }); await expect(lb).toBeVisible(); await expect(lb.locator('.lb-img')).toBeVisible(); await expect(lb).toContainText('1 / 1')
    await expect(lb).toContainText('Diunggah oleh Agus Santoso'); await expect(lb).toContainText('lokasi-1.png'); await expect.poll(() => lb.locator('.lb-img').evaluate((i) => i.naturalWidth > 0)).toBe(true)
  })
  test('tutup dengan Esc, tombol ×, dan klik latar', async ({ page }) => {
    await open(page); await page.setInputFiles('input[type=file]', png('a.png')); await expect(thumbs(page)).toHaveCount(1); const lb = page.locator('.lb')
    await thumbs(page).first().click(); await expect(lb).toBeVisible(); await page.keyboard.press('Escape'); await expect(lb).toHaveCount(0)
    await thumbs(page).first().click(); await page.getByRole('button', { name: 'Tutup' }).click(); await expect(lb).toHaveCount(0)
    await thumbs(page).first().click(); await page.locator('.lb-stage').click({ position: { x: 5, y: 5 } }); await expect(lb).toHaveCount(0)
  })
  test('banyak foto: navigasi dengan tombol dan panah keyboard (melingkar)', async ({ page }) => {
    await open(page); for (const n of ['a.png', 'b.png', 'c.png']) { await page.setInputFiles('input[type=file]', png(n)); await page.waitForTimeout(400) }
    await expect(thumbs(page)).toHaveCount(3); await thumbs(page).nth(0).click(); const c = page.locator('.lb-count'); await expect(c).toHaveText('1 / 3')
    await page.keyboard.press('ArrowRight'); await expect(c).toHaveText('2 / 3'); await page.getByRole('button', { name: 'Foto berikutnya' }).click(); await expect(c).toHaveText('3 / 3')
    await page.keyboard.press('ArrowRight'); await expect(c).toHaveText('1 / 3'); await page.keyboard.press('ArrowLeft'); await expect(c).toHaveText('3 / 3'); await page.getByRole('button', { name: 'Foto sebelumnya' }).click(); await expect(c).toHaveText('2 / 3')
  })
  test('satu foto: tidak ada tombol navigasi', async ({ page }) => {
    await open(page); await page.setInputFiles('input[type=file]', png('a.png')); await expect(thumbs(page)).toHaveCount(1); await thumbs(page).first().click(); await expect(page.getByRole('button', { name: 'Foto berikutnya' })).toHaveCount(0)
  })
  test('hapus foto lewat pratinjau: konfirmasi dulu, bisa dibatalkan', async ({ page }) => {
    await open(page); await page.setInputFiles('input[type=file]', png('a.png')); await expect(thumbs(page)).toHaveCount(1); await thumbs(page).first().click()
    await page.getByRole('button', { name: 'Hapus foto' }).click(); const k = page.getByRole('alertdialog'); await expect(k).toContainText('Hapus foto ini?'); await k.getByRole('button', { name: 'Batal' }).click(); await expect(k).toHaveCount(0); await expect(thumbs(page)).toHaveCount(1)
    await page.getByRole('button', { name: 'Hapus foto' }).click(); await page.getByRole('alertdialog').getByRole('button', { name: 'Ya, hapus' }).click(); await expect(page.locator('.lb')).toHaveCount(0); await expect(thumbs(page)).toHaveCount(0)
  })
  test('Esc saat konfirmasi hapus hanya menutup konfirmasi', async ({ page }) => {
    await open(page); await page.setInputFiles('input[type=file]', png('a.png')); await expect(thumbs(page)).toHaveCount(1); await thumbs(page).first().click(); await page.getByRole('button', { name: 'Hapus foto' }).click(); await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toHaveCount(0); await expect(page.locator('.lb')).toBeVisible()
  })
  test('foto yang belum ada di perangkat ini tampil sebagai penanda, bukan gambar rusak', async ({ page }) => {
    await open(page, 'surveyor', {}); await expect(page.locator('.ph-miss')).toHaveCount(1); await expect(page.locator('.photos img')).toHaveCount(0)
    await thumbs(page).first().click(); await expect(page.locator('.lb-empty')).toContainText('belum tersedia')
  })
  test('manajer (lihat saja): tidak ada tambah/hapus foto', async ({ page }) => {
    await open(page, 'manajer', {}); await expect(page.locator('.ph.add')).toHaveCount(0); await thumbs(page).first().click(); await expect(page.getByRole('button', { name: 'Hapus foto' })).toHaveCount(0)
  })
  test('foto bisa ditambah oleh pemilik lewat tombol "Tambah foto"', async ({ page }) => {
    await open(page); await expect(page.getByRole('button', { name: 'Tambah foto' })).toBeVisible()
  })
  test('body tidak bisa digulir saat pratinjau terbuka', async ({ page }) => {
    await open(page); await page.setInputFiles('input[type=file]', png('a.png')); await expect(thumbs(page)).toHaveCount(1); await thumbs(page).first().click(); expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
    await page.keyboard.press('Escape'); expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  })
})
