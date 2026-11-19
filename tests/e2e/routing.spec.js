import { expect, guideItem, lanjut, projectDoc, seed, stepBtn, test } from './fixtures'

const K = 'kode0001ab'
test.describe('Alamat halaman (routing)', () => {
  const titles = { data: 'Data Pelanggan', peta: 'Peta & Tagging', gambar: 'Gambar Skematik', rab: 'Material & RAB', ekspor: 'Foto & Ekspor' }
  for (const [s, label] of Object.entries(titles)) {
    test(`/project/<kode>/${s} membuka langkah "${label}"`, async ({ page }) => {
      await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto(`/project/${K}/${s}`)
      await expect(page.locator('.stepmeta-t span')).toContainText(label); await expect(page.locator('.step [aria-current=step]')).toHaveCount(1); await expect(page).toHaveTitle(new RegExp(label.replace('&', '&')))
    })
  }
  test('/project/<kode> dialihkan ke langkah data', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto(`/project/${K}`); await expect(page).toHaveURL(`/project/${K}/data`)
  })
  test('kode tidak dikenal: pesan dan tombol kembali ke daftar', async ({ page }) => {
    await seed(page, 'surveyor'); await page.goto('/project/zzzzzzzz99/peta'); await expect(page.getByText('tidak ditemukan')).toBeVisible(); await page.locator('.rmain').getByRole('button', { name: 'Ke daftar project' }).click(); await expect(page).toHaveURL('/')
  })
  test('alamat tidak dikenal menampilkan halaman tidak ditemukan', async ({ page }) => {
    await seed(page, 'surveyor'); await page.goto('/ngawur/sekali'); await expect(page.getByText('Halaman tidak ditemukan')).toBeVisible()
  })
  test('tautan lama #/p/<kode> dialihkan ke alamat baru', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto(`/#/p/${K}`); await expect(page).toHaveURL(`/project/${K}/data`)
  })
  test('project dibuka dari alamat meski belum ada di perangkat (diambil dari server tiruan)', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [], server: [projectDoc({ n: 7, kode: 'server0007x2', nama: 'DARI SERVER' })] }); await page.goto('/project/server0007x2/data')
    await expect(page.locator('.stepmeta-t b')).toContainText('DARI SERVER')
  })
  test('judul tab mengikuti halaman', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto('/'); await expect(page).toHaveTitle(/Daftar project/)
    await page.goto('/offline'); await expect(page).toHaveTitle(/Offline & Sinkron/); await page.goto('/project/baru'); await expect(page).toHaveTitle(/Project baru/)
  })
  test('panel status sinkron membuka Offline & Sinkron; Kembali ke halaman sebelumnya', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto(`/project/${K}/peta`); await page.locator('.pill.sync').click(); await expect(page).toHaveURL('/offline')
    await page.getByRole('button', { name: 'Kembali' }).click(); await expect(page).toHaveURL(`/project/${K}/peta`)
  })
  test('tombol "Peta offline" di langkah Peta menuju /offline', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto(`/project/${K}/peta`); await page.getByRole('button', { name: /Peta offline/ }).click(); await expect(page).toHaveURL('/offline')
  })
  test('klik stepper mengubah alamat', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto(`/project/${K}/data`); await stepBtn(page, 4).click(); await expect(page).toHaveURL(`/project/${K}/rab`)
  })
  test('Lanjut/Sebelumnya mengikuti urutan langkah', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto(`/project/${K}/gambar`); await lanjut(page).click(); await expect(page).toHaveURL(/\/rab$/)
    await page.locator('.stepfoot .btn').first().click(); await expect(page).toHaveURL(/\/gambar$/)
  })
  test('manifest PWA dan health tersedia', async ({ request }) => {
    expect((await request.get('/api/health')).ok()).toBe(true); const m = await (await request.get('/manifest.webmanifest')).json(); expect(m.short_name).toBe('Survei PLN')
    expect((await request.get('/mock/master.json')).ok()).toBe(true)
  })
  test('panduan langkah ikut berganti sesuai alamat', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc({ guide: {} })] }); await page.goto(`/project/${K}/peta`); await expect(page.locator('.guide-d h2')).toHaveText('Tandai jalur di peta'); await expect(guideItem(page, 'Tekan Selesai')).toBeVisible()
    await page.goto(`/project/${K}/data`); await expect(page.locator('.guide-d h2')).toHaveText('Isi data pelanggan')
  })
})
