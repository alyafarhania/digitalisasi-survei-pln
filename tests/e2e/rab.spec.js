import { expect, lanjut, projectDoc, seed, stepBtn, test } from './fixtures'

const total = (page) => page.getByTestId('grand-total')
const open = async (page, over = {}) => { await seed(page, 'surveyor', { projects: [projectDoc(over)] }); await page.goto('/project/kode0001ab/rab'); await expect(page.getByTestId('rab-table')).toBeVisible() }

test.describe('Material & RAB', () => {
  test('harga satuan berisi angka sebenarnya (bukan kolom kosong)', async ({ page }) => {
    await open(page); const v = await page.getByTestId('harga-input').first().inputValue(); expect(v).toMatch(/\d/)
  })
  test('ubah harga satuan: total berubah, baris ditandai, bisa dikembalikan per baris', async ({ page }) => {
    await open(page); const t0 = await total(page).innerText(), inp = page.getByTestId('harga-input').first()
    await inp.fill('9999999'); await expect(total(page)).not.toHaveText(t0); await expect(inp.locator('xpath=..')).toHaveClass(/edited/)
    await page.getByRole('button', { name: /Kembalikan harga Tiang/ }).click(); await expect(total(page)).toHaveText(t0)
  })
  test('tombol "Kembalikan N harga" mengembalikan semua ubahan', async ({ page }) => {
    await open(page); const t0 = await total(page).innerText(); const ins = page.getByTestId('harga-input')
    await ins.nth(0).fill('111'); await ins.nth(1).fill('222'); await expect(page.getByRole('button', { name: 'Kembalikan 2 harga' })).toBeVisible()
    await page.getByRole('button', { name: 'Kembalikan 2 harga' }).click(); await expect(total(page)).toHaveText(t0)
  })
  test('ubahan harga tersimpan setelah reload', async ({ page }) => {
    await open(page); await page.getByTestId('harga-input').first().fill('7777777'); const t1 = await total(page).innerText(); await page.waitForTimeout(1200); await page.reload()
    await expect(total(page)).toHaveText(t1)
  })
  test('SLO: tata letak tabel sama saat dihidupkan/dimatikan, baris SLO tetap ada', async ({ page }) => {
    await open(page); const sw = page.getByTestId('slo-switch'), tbl = page.getByTestId('rab-table')
    const w1 = (await tbl.boundingBox()).width, tot1 = await total(page).innerText(); await expect(sw).toHaveAttribute('aria-checked', 'true'); await expect(page.getByTestId('slo-row')).toBeVisible()
    await sw.click(); await expect(sw).toHaveAttribute('aria-checked', 'false'); await expect(page.getByTestId('slo-row')).toBeVisible(); await expect(page.getByTestId('slo-row')).toContainText('tidak diterapkan')
    expect((await tbl.boundingBox()).width).toBe(w1); await expect(total(page)).not.toHaveText(tot1)
    await sw.click(); await expect(total(page)).toHaveText(tot1) // kembali persis sama
  })
  test('tabel tidak terpotong: semua kolom terlihat tanpa gulir horizontal (layar lebar)', async ({ page }) => {
    await open(page); const o = await page.locator('.tbl-wrap').evaluate((e) => ({ s: e.scrollWidth, c: e.clientWidth })); expect(o.s).toBeLessThanOrEqual(o.c + 1)
    for (const h of ['NO', 'URAIAN', 'VOL', 'HARGA SATUAN', 'MDU', 'HARDWARE', 'JASA', 'JUMLAH']) await expect(page.locator('.rabt thead th', { hasText: new RegExp(`^${h}$`) })).toBeVisible()
  })
  test('baris ringkasan: jumlah, PPN 11%, total, dan terbilang', async ({ page }) => {
    await open(page); await expect(page.locator('.rabt tr.sumrow').nth(0)).toContainText('Jumlah MDU - Hardware - Jasa'); await expect(page.locator('.rabt tr.sumrow').nth(1)).toContainText('PPN 11%'); await expect(page.locator('.rabt tr.tot')).toContainText('Jumlah Total'); await expect(page.locator('.rab-note')).toContainText('Terbilang'); await expect(page.locator('.rab-note')).toContainText('Rupiah')
  })
  test('kelompok pekerjaan A, B, C tampil', async ({ page }) => {
    await open(page); for (const t of ['PEKERJAAN PENANAMAN TIANG', 'PEKERJAAN PEMASANGAN KONSTRUKSI', 'PEKERJAAN PENARIKAN PENGHANTAR']) await expect(page.locator('.rabt tr.grp', { hasText: t })).toBeVisible()
  })
  test('KHS dengan harga kosong: peringatan merah, Lanjut & Ekspor terkunci; terbuka setelah diisi', async ({ page }) => {
    await open(page); await page.getByRole('button', { name: 'KHS 2024' }).click()
    const alert = page.locator('.alert.bad'); await expect(alert).toContainText('Ekspor RAB terkunci'); await expect(lanjut(page)).toBeDisabled(); await expect(stepBtn(page, 5)).toBeDisabled()
    const kosong = page.locator('.pin.empty input'); expect(await kosong.count()).toBeGreaterThan(0)
    for (let i = 0; i < 30 && (await kosong.count()) > 0; i++) await kosong.first().fill('1000') // satu harga bisa mengisi beberapa baris
    await expect(alert).toHaveCount(0); await expect(lanjut(page)).toBeEnabled()
  })
  test('jenis RAB "Non MDU" menurunkan total', async ({ page }) => {
    await open(page); const num = async () => Number((await total(page).innerText()).replace(/\D/g, '')); const t0 = await num()
    await page.getByLabel('Jenis RAB').selectOption('Non MDU'); expect(await num()).toBeLessThan(t0)
  })
  test('pilihan harga HSS/KHS dan asal material tersedia', async ({ page }) => {
    await open(page); await expect(page.getByRole('button', { name: 'HSS 2024' })).toHaveAttribute('aria-pressed', 'true'); await page.getByLabel('Asal material (semua baris)').selectOption('Vendor'); await expect(page.getByLabel('Asal material (semua baris)')).toHaveValue('Vendor')
  })
  test('panduan RAB dilipat di atas (tabel memakai lebar penuh)', async ({ page }) => {
    await open(page); await expect(page.locator('.guide-d')).toBeHidden(); await expect(page.locator('.guide-m summary')).toBeVisible()
  })
  test('lihat-saja: harga tidak bisa diubah oleh manajer', async ({ page }) => {
    await seed(page, 'manajer', { projects: [projectDoc()] }); await page.goto('/project/kode0001ab/rab'); await expect(page.getByTestId('harga-input').first()).toBeDisabled(); await expect(page.getByTestId('slo-switch')).toBeDisabled()
  })
})
