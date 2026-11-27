import ExcelJS from 'exceljs'
import { card, createProject, expect, guideItem, lanjut, projectDoc, seed, stepBtn, tagPoints, test } from './fixtures'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC', 'base64')

test.describe('Alur kerja 5 langkah', () => {
  test('dari data pelanggan sampai ekspor Excel dan simpan', async ({ page }) => {
    await seed(page, 'surveyor'); await createProject(page)
    // 2. Peta
    await expect(page.locator('.stepmeta-t span')).toContainText('Langkah 2 dari 5'); await expect(lanjut(page)).toBeDisabled()
    await tagPoints(page, 2); await expect(lanjut(page)).toBeDisabled() // belum "Selesai"
    await page.locator('.map-bar button', { hasText: 'Selesai' }).click(); await expect(lanjut(page)).toBeEnabled(); await lanjut(page).click(); await expect(page).toHaveURL(/\/gambar$/)
    // 3. Gambar: dua isian wajib
    await expect(page.locator('.gtb .req')).toHaveCount(2); await expect(lanjut(page)).toBeDisabled()
    await page.getByPlaceholder('Wajib diisi', { exact: true }).fill('001/PLN/2026'); await page.getByPlaceholder('Nama (wajib diisi)').fill('Agus Santoso'); await expect(page.locator('.gtb .req')).toHaveCount(0)
    await expect(lanjut(page)).toBeDisabled() // masih butuh centang "Gambar terbaca jelas"
    await guideItem(page, 'Gambar terbaca jelas').click(); await expect(lanjut(page)).toBeEnabled(); await lanjut(page).click(); await expect(page).toHaveURL(/\/rab$/)
    // 4. RAB
    await expect(page.getByTestId('rab-table')).toBeVisible(); await expect(page.getByTestId('grand-total')).toContainText('Rp'); await expect(lanjut(page)).toBeDisabled()
    await page.locator('.guide-m summary').click(); await page.locator('.guide-m .gitem', { hasText: 'Periksa pilihan harga' }).click(); await expect(lanjut(page)).toBeEnabled(); await lanjut(page).click(); await expect(page).toHaveURL(/\/ekspor$/)
    // 5. Foto & ekspor
    await expect(page.getByRole('button', { name: 'Simpan project' })).toBeEnabled()
    await page.setInputFiles('input[type=file]', { name: 'lokasi.png', mimeType: 'image/png', buffer: PNG }); await expect(page.locator('.photos .ph:not(.add)')).toHaveCount(1)
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Unduh Excel (.xlsx)' }).click()])
    expect(dl.suggestedFilename()).toMatch(/\.xlsx$/)
    const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(await dl.path())
    expect(wb.worksheets.map((w) => w.name)).toEqual(['GAMBAR', 'RAB']); expect(wb.getWorksheet('GAMBAR').getImages().length).toBe(1)
    const rab = wb.getWorksheet('RAB'), teks = []; rab.eachRow((r) => r.eachCell((c) => teks.push(String(c.value?.result ?? c.value ?? ''))))
    expect(teks).toContain('RENCANA ANGGARAN BIAYA (RAB)'); expect(teks.some((t) => t.includes('PEKERJAAN PENANAMAN TIANG'))).toBe(true); expect(teks.some((t) => t.startsWith('Terbilang'))).toBe(true)
    expect(teks.some((t) => t.includes('PABRIK UJI'))).toBe(true)
    // simpan
    await page.getByRole('button', { name: 'Simpan project' }).click(); await expect(page.locator('.snack')).toContainText('tersimpan dan tersinkron'); await expect(page).toHaveURL('/')
    await expect(card(page, 'PABRIK UJI')).toContainText('5/5 langkah')
  })
  test('langkah terkunci pada project baru dan petunjuk apa yang kurang', async ({ page }) => {
    await seed(page, 'surveyor'); await createProject(page)
    for (const n of [3, 4, 5]) await expect(stepBtn(page, n)).toBeDisabled()
    await expect(page.locator('.stepfoot-msg')).toContainText('Tandai minimal 2 titik'); await expect(stepBtn(page, 1)).toBeEnabled()
  })
  test('alamat langkah terkunci (diketik langsung) dialihkan ke langkah yang harus dikerjakan', async ({ page }) => {
    await seed(page, 'surveyor'); const kode = await createProject(page)
    await page.goto(`/project/${kode}/rab`); await expect(page).toHaveURL(new RegExp(`/project/${kode}/peta$`)); await expect(page.locator('.snack')).toContainText('Selesaikan langkah sebelumnya')
  })
  test('Kembali meminta konfirmasi: project disimpan sebagai Draft', async ({ page }) => {
    await seed(page, 'surveyor'); const kode = await createProject(page)
    await page.locator('.backlink').click(); const m = page.locator('.modal'); await expect(m).toContainText('Keluar dari project ini?'); await expect(m).toContainText('Draft'); await expect(m).toContainText('Finalisasi')
    await m.getByRole('button', { name: 'Tetap di sini' }).click(); await expect(m).toHaveCount(0); await expect(page).toHaveURL(new RegExp(`/project/${kode}/peta`))
    await page.locator('.backlink').click(); await page.getByRole('button', { name: 'Simpan sebagai Draft & keluar' }).click()
    await expect(page).toHaveURL('/'); await expect(page.locator('.snack')).toContainText('Draft'); await expect(card(page, 'PABRIK UJI')).toContainText('Draft')
  })
  test('logo header juga meminta konfirmasi saat berada di dalam project', async ({ page }) => {
    await seed(page, 'surveyor'); await createProject(page); await page.locator('.rbrand').click(); await expect(page.locator('.modal')).toContainText('Keluar dari project ini?')
  })
  test('Kembali pada project baru: konfirmasi buang data', async ({ page }) => {
    await seed(page, 'surveyor'); await page.goto('/project/baru'); await page.getByPlaceholder('Nama pelanggan').fill('DATA SEMENTARA')
    await page.getByRole('button', { name: 'Batal' }).click(); const m = page.locator('.modal'); await expect(m).toContainText('Batalkan project baru?'); await expect(m).toContainText('dibuang')
    await m.getByRole('button', { name: 'Lanjut mengisi' }).click(); await expect(page).toHaveURL('/project/baru'); await expect(page.getByPlaceholder('Nama pelanggan')).toHaveValue('DATA SEMENTARA')
    await page.locator('.backlink').click(); await page.getByRole('button', { name: 'Ya, buang data' }).click(); await expect(page).toHaveURL('/'); await expect(page.getByText('Belum ada project')).toBeVisible()
  })
  test('project Final: Kembali langsung ke daftar tanpa konfirmasi', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc({ status: 'Selesai' })] }); await page.goto('/project/kode0001ab/data'); await page.locator('.backlink').click(); await expect(page).toHaveURL('/')
  })
  test('panduan: butir otomatis tercoret dan butir manual bisa dicentang (tersimpan)', async ({ page }) => {
    await seed(page, 'surveyor'); const kode = await createProject(page); const item = guideItem(page, 'Tandai jalan, sungai')
    await expect(item.locator('..')).not.toHaveClass(/done/); await item.click(); await expect(item.locator('..')).toHaveClass(/done/)
    expect(await item.locator('.gtxt').evaluate((e) => getComputedStyle(e).textDecorationLine)).toBe('line-through')
    await page.reload(); await expect(guideItem(page, 'Tandai jalan, sungai').locator('..')).toHaveClass(/done/)
    await item.click(); await expect(item.locator('..')).not.toHaveClass(/done/) // bisa dibatalkan
    await expect(guideItem(page, 'Ketuk peta untuk menaruh titik').locator('..')).not.toHaveClass(/done/); void kode
  })
  test('butir otomatis tidak bisa dicentang manual', async ({ page }) => {
    await seed(page, 'surveyor'); await createProject(page); const auto = page.locator('.guide-d .gitem.static', { hasText: 'Ketuk peta untuk menaruh titik' }); await expect(auto).toHaveAttribute('aria-readonly', 'true'); await auto.click({ force: true }); await expect(auto.locator('..')).not.toHaveClass(/done/)
  })
  test('menandai titik membuat butir otomatis tercoret dan progres naik', async ({ page }) => {
    await seed(page, 'surveyor'); await createProject(page); const prog = page.locator('.guide-prog span'); const before = await prog.innerText()
    await tagPoints(page, 2); await expect(guideItem(page, 'Ketuk peta untuk menaruh titik').locator('..')).toHaveClass(/done/); expect(await prog.innerText()).not.toBe(before)
  })
  test('belokan tajam (sudut dalam < 90°) diberi peringatan dan label yang benar', async ({ page }) => {
    const p = projectDoc(); p.points[1].sudut = 120
    await seed(page, 'surveyor', { projects: [p] }); await page.goto('/project/kode0001ab/peta')
    await expect(page.locator('.stat').nth(2)).toContainText('Belokan tajam (sudut dalam < 90°)'); await expect(page.locator('.stat b').nth(2)).toHaveText('1')
    await expect(page.locator('.stepfoot-msg')).toContainText('belokan tajam'); await expect(guideItem(page, 'Tidak ada belokan tajam').locator('..')).not.toHaveClass(/done/)
  })
  test('belokan 90° tepat belum dianggap tajam', async ({ page }) => {
    const p = projectDoc(); p.points[1].sudut = 90
    await seed(page, 'surveyor', { projects: [p] }); await page.goto('/project/kode0001ab/peta'); await expect(page.locator('.stat b').nth(2)).toHaveText('0')
  })
  test('navigasi SPA: pindah langkah tanpa memuat ulang halaman, Back browser berfungsi', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto('/project/kode0001ab/data'); await page.evaluate(() => { window.__marker = 'hidup' })
    await lanjut(page).click(); await expect(page).toHaveURL(/\/peta$/); await lanjut(page).click(); await expect(page).toHaveURL(/\/gambar$/)
    expect(await page.evaluate(() => window.__marker)).toBe('hidup')
    await page.goBack(); await expect(page).toHaveURL(/\/peta$/); await page.goBack(); await expect(page).toHaveURL(/\/data$/); await page.goForward(); await expect(page).toHaveURL(/\/peta$/)
  })
  test('Data pelanggan: ubah nama tersimpan di server tiruan dan tampil di daftar', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto('/project/kode0001ab/data'); await page.getByPlaceholder('Nama pelanggan').fill('NAMA BARU'); await page.waitForTimeout(1200)
    await page.goto('/'); await expect(card(page, 'NAMA BARU')).toBeVisible(); await expect(card(page, 'NAMA BARU').locator('.paudit')).toContainText('Agus Santoso')
  })
  test('Simpan project tampil di langkah terakhir dan menyimpan sebagai tersinkron', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc({ version: 0, dirty: true })] }); await page.goto('/project/kode0001ab/ekspor')
    await page.getByRole('button', { name: 'Simpan project' }).click(); await expect(page.locator('.snack')).toContainText('tersimpan'); await expect(card(page, 'PABRIK UJI 1')).toContainText('Tersinkron')
  })
  test('offline: Simpan project menyimpan di perangkat lalu terkirim saat online', async ({ page, context }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto('/project/kode0001ab/data'); await expect(page.getByPlaceholder('Nama pelanggan')).toBeVisible(); await context.setOffline(true)
    await page.getByPlaceholder('Nama pelanggan').fill('EDIT OFFLINE'); await stepBtn(page, 5).click(); await page.getByRole('button', { name: 'Simpan project' }).click()
    await expect(page.locator('.snack')).toContainText('tersimpan di perangkat'); await expect(page.locator('.pill.sync')).toContainText(/Offline|menunggu/i)
    await context.setOffline(false); await expect(page.locator('.pill.sync')).toContainText('Tersinkron', { timeout: 15000 })
  })
})
