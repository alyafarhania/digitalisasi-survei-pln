import { card, cards, createProject, expect, logout, login, projectDoc, seed, test } from './fixtures'

const au = (page, t) => card(page, t).locator('.paudit')
test.describe('Audit: dibuat, difinalisasi, terakhir diubah', () => {
  test('membuat project: pembuat dan waktu tampil di kartu', async ({ page }) => {
    await seed(page, 'surveyor'); await createProject(page); await page.goto('/')
    await expect(au(page, 'PABRIK UJI')).toContainText('Dibuat oleh'); await expect(au(page, 'PABRIK UJI')).toContainText('Agus Santoso'); await expect(au(page, 'PABRIK UJI')).toContainText(/2026/)
  })
  test('finalisasi: pop-up konfirmasi → kartu menampilkan "Difinalisasi oleh" + status Final', async ({ page }) => {
    await seed(page, 'asman', { projects: [projectDoc()] }); await page.goto('/'); await page.getByRole('button', { name: 'Finalisasi' }).click()
    const m = page.locator('.modal'); await expect(m).toContainText('Finalisasi project?'); await expect(m).toContainText('Bagus Prasetyo'); await expect(m).toContainText('dikunci')
    await m.getByRole('button', { name: 'Ya, finalisasi' }).click()
    const a = au(page, 'PABRIK UJI 1'); await expect(a).toContainText('Difinalisasi oleh'); await expect(a).toContainText('Bagus Prasetyo'); await expect(a).toContainText('Dibuat oleh'); await expect(a).toContainText('Agus Santoso')
    await expect(card(page, 'PABRIK UJI 1').locator('.chip2', { hasText: 'Final' })).toBeVisible()
  })
  test('finalisasi ditolak untuk project yang langkahnya belum lengkap', async ({ page }) => {
    await seed(page, 'asman', { projects: [projectDoc({ points: [], guide: {} })] }); await page.goto('/'); await page.getByRole('button', { name: 'Finalisasi' }).click()
    await expect(page.locator('.modal')).toContainText('Belum bisa difinalisasi'); await expect(page.locator('.modal').getByRole('button', { name: 'Ya, finalisasi' })).toBeDisabled()
  })
  test('project Final terkunci; riwayat mencatat "Difinalisasi" dan "Dibuat"', async ({ page }) => {
    await seed(page, 'asman', { projects: [projectDoc()] }); await page.goto('/'); await page.getByRole('button', { name: 'Finalisasi' }).click(); await page.locator('.modal').getByRole('button', { name: 'Ya, finalisasi' }).click()
    await page.getByRole('button', { name: 'Riwayat' }).click(); const tl = page.locator('.timeline'); await expect(tl).toContainText('Difinalisasi'); await expect(tl).toContainText('Bagus Prasetyo'); await expect(tl).toContainText('Dibuat'); await expect(tl).toContainText('Agus Santoso')
    await page.locator('.modal').getByRole('button', { name: 'Tutup' }).first().click()
    await page.getByRole('button', { name: 'Buka', exact: true }).click(); await expect(page.locator('.alert.info')).toContainText('Final')
  })
  test('buka kembali: kembali Draft, jejak finalisasi hilang dari kartu, riwayat mencatat', async ({ page }) => {
    await seed(page, 'asman', { projects: [projectDoc({ status: 'Selesai', finalizedBy: { id: 'u-asman', name: 'Dewi Kartika', role: 'asman' }, finalizedAt: '2026-11-18T10:00:00.000Z', audit: [{ id: 'x', action: 'finalized', by: { id: 'u-asman', name: 'Dewi Kartika', role: 'asman' }, at: '2026-11-18T10:00:00.000Z' }] })] })
    await page.goto('/'); await expect(au(page, 'PABRIK UJI 1')).toContainText('Dewi Kartika'); await page.getByRole('button', { name: 'Buka kembali' }).click()
    const m = page.locator('.modal'); await expect(m).toContainText('Buka kembali project?'); await expect(m).toContainText('Bagus Prasetyo'); await m.getByRole('button', { name: 'Ya, jadikan Draft' }).click()
    await expect(au(page, 'PABRIK UJI 1')).not.toContainText('Difinalisasi'); await expect(card(page, 'PABRIK UJI 1').locator('.chip2', { hasText: 'Draft' })).toBeVisible()
    await page.getByRole('button', { name: 'Riwayat' }).click(); await expect(page.locator('.timeline')).toContainText('Dibuka kembali')
  })
  test('terakhir diubah mengikuti pengubah terakhir, pembuat tetap', async ({ page }) => {
    await seed(page, 'asman', { projects: [projectDoc()] }); await page.goto('/project/kode0001ab/data'); await page.getByPlaceholder('Nama pelanggan').fill('DIUBAH PERENCANA'); await page.waitForTimeout(1000)
    await page.goto('/'); const a = au(page, 'DIUBAH PERENCANA'); await expect(a.locator('div', { hasText: 'Terakhir diubah' }).first()).toContainText('Bagus Prasetyo'); await expect(a.locator('div', { hasText: 'Dibuat oleh' }).first()).toContainText('Agus Santoso')
  })
  test('menyalin dicatat atas nama penyalin (riwayat: "Salinan dari …")', async ({ page }) => {
    await seed(page, 'asman', { projects: [projectDoc()] }); await page.goto('/'); await page.getByRole('button', { name: 'Salin' }).click()
    const s = card(page, '(salinan)'); await expect(s).toBeVisible(); await expect(s.locator('.paudit')).toContainText('Dewi Kartika'); await s.getByRole('button', { name: 'Riwayat' }).click(); await expect(page.locator('.timeline')).toContainText('Salinan dari PB-2026-001')
  })
  test('riwayat hanya untuk peran dengan izin audit (surveyor tidak melihatnya)', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto('/'); await expect(page.getByRole('button', { name: 'Riwayat' })).toHaveCount(0)
  })
  test('alur lintas peran: surveyor membuat, asman/MULP memfinalisasi (kedua nama tampil)', async ({ page }) => {
    await login(page, 'surveyor'); const kode = await createProject(page, { nama: 'LINTAS PERAN' }); void kode
    // lengkapi dokumen langsung agar bisa difinalisasi
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('pln-survey-v2')); const p = s.projects[0]; const by = p.createdBy; p.points = [0, 1, 2].map((i) => ({ id: 'p' + i, lat: -7.7059 - i * 0.0006, lng: 110.6012 + i * 0.0008, nomor: 'T' + (i + 1), jenisTiang: 'Tiang Beton 12M-350 daN+E', konduktor: 'AAAC 70 mm²', kondisi: 'Baru', sudut: 0, kode: 'CC1' })); p.meta.noGambar = '1'; p.meta.digambar = by.name; p.foto = [{ id: 'f' }]; p.guide = { 'peta:selesai': true, 'gambar:cek': true, 'rab:opsi': true, 'ekspor:unduh': true }; localStorage.setItem('pln-survey-v2', JSON.stringify(s)) })
    await logout(page); await login(page, 'asman'); await page.getByRole('button', { name: 'Finalisasi' }).click(); await page.locator('.modal').getByRole('button', { name: 'Ya, finalisasi' }).click()
    const a = au(page, 'LINTAS PERAN'); await expect(a).toContainText('Agus Santoso'); await expect(a).toContainText('Bagus Prasetyo'); await expect(cards(page)).toHaveCount(1)
  })
})
