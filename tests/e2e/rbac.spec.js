import { cards, card, expect, lanjut, projectDoc, seed, stepBtn, test, USERS } from './fixtures'

const trash = (page) => page.locator('[aria-label^="Hapus project"]')
test.describe('RBAC (mock): tombol di daftar project', () => {
  test('surveyor: bisa buat & salin, tidak bisa finalisasi/riwayat; hapus milik sendiri', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto('/')
    await expect(page.getByRole('button', { name: 'Project baru' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Salin' })).toBeVisible()
    for (const n of ['Finalisasi', 'Buka kembali', 'Riwayat']) await expect(page.getByRole('button', { name: n })).toHaveCount(0)
    await expect(trash(page)).toHaveCount(1)
  })
  test('surveyor tidak bisa menghapus project buatan surveyor lain', async ({ page }) => {
    await seed(page, 'surveyor2', { projects: [projectDoc()] }); await page.goto('/'); await expect(cards(page)).toHaveCount(1); await expect(trash(page)).toHaveCount(0)
  })
  test('perencana: finalisasi + riwayat, tanpa hapus', async ({ page }) => {
    await seed(page, 'perencana', { projects: [projectDoc()] }); await page.goto('/')
    await expect(page.getByRole('button', { name: 'Finalisasi' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Riwayat' })).toBeVisible(); await expect(trash(page)).toHaveCount(0)
  })
  test('admin: semua aksi termasuk hapus project orang lain', async ({ page }) => {
    await seed(page, 'admin', { projects: [projectDoc()] }); await page.goto('/')
    await expect(page.getByRole('button', { name: 'Finalisasi' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Riwayat' })).toBeVisible(); await expect(trash(page)).toHaveCount(1)
  })
  test('manajer: tidak ada Project baru/Salin/Hapus/Finalisasi; ada Riwayat', async ({ page }) => {
    await seed(page, 'manajer', { projects: [projectDoc()] }); await page.goto('/')
    for (const n of ['Project baru', 'Salin', 'Finalisasi']) await expect(page.getByRole('button', { name: n })).toHaveCount(0)
    await expect(trash(page)).toHaveCount(0); await expect(page.getByRole('button', { name: 'Riwayat' })).toBeVisible()
  })
  test('tombol aksi untuk project Final: Buka kembali (perencana) menggantikan Finalisasi', async ({ page }) => {
    await seed(page, 'perencana', { projects: [projectDoc({ status: 'Selesai', finalizedBy: { id: 'u-admin', name: 'Dewi Kartika', role: 'admin' }, finalizedAt: '2026-11-18T10:00:00.000Z' })] }); await page.goto('/')
    await expect(page.getByRole('button', { name: 'Buka kembali' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Finalisasi' })).toHaveCount(0)
  })
})
test.describe('RBAC (mock): mode lihat saja di dalam project', () => {
  test('surveyor lain: project dibuka lihat-saja, isian terkunci, tanpa Simpan', async ({ page }) => {
    await seed(page, 'surveyor2', { projects: [projectDoc()] }); await page.goto('/'); await card(page, 'PABRIK UJI 1').getByRole('button', { name: 'Buka' }).click()
    await expect(page).toHaveURL(/\/project\/kode0001ab\/data/); await expect(page.getByText('Mode lihat saja').first()).toBeVisible(); await expect(page.locator('.alert.info')).toContainText('Agus Santoso')
    await expect(page.getByPlaceholder(/^contoh PABRIK/)).toBeDisabled()
  })
  test('lihat-saja: semua langkah bisa dibuka dan Lanjut aktif walau langkah belum lengkap', async ({ page }) => {
    await seed(page, 'manajer', { projects: [projectDoc({ points: [], guide: {} })] }); await page.goto('/project/kode0001ab/data')
    await expect(stepBtn(page, 4)).toBeEnabled(); await expect(lanjut(page)).toBeEnabled()
    await stepBtn(page, 4).click(); await expect(page).toHaveURL(/\/rab$/)
  })
  test('project Final terkunci untuk semua peran, termasuk admin', async ({ page }) => {
    await seed(page, 'admin', { projects: [projectDoc({ status: 'Selesai' })] }); await page.goto('/project/kode0001ab/data')
    await expect(page.locator('.alert.info')).toContainText('Final'); await expect(page.getByPlaceholder(/^contoh PABRIK/)).toBeDisabled()
  })
  test('manajer tidak boleh membuat project lewat alamat langsung', async ({ page }) => {
    await seed(page, 'manajer'); await page.goto('/project/baru'); await expect(page.getByText('tidak dapat membuat project baru')).toBeVisible()
  })
  test('manajer boleh ekspor tetapi tidak menambah foto', async ({ page }) => {
    await seed(page, 'manajer', { projects: [projectDoc()] }); await page.goto('/project/kode0001ab/ekspor')
    await expect(page.getByRole('button', { name: 'Unduh Excel (.xlsx)' })).toBeEnabled(); await expect(page.locator('.ph.add')).toHaveCount(0)
  })
  test('peran tanpa izin ekspor tidak tersedia: semua peran demo memilikinya (matriks)', async () => {
    for (const u of Object.values(USERS)) expect(['admin', 'perencana', 'surveyor', 'manajer']).toContain(u.role)
  })
  test('surveyor pemilik tetap bisa mengubah (isian aktif)', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto('/project/kode0001ab/data'); await expect(page.getByPlaceholder(/^contoh PABRIK/)).toBeEnabled(); await expect(page.locator('.alert.info')).toHaveCount(0)
  })
})
