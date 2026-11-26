import { card, cards, createProject, expect, guideItem, lanjut, login, projectDoc, seed, tagPoints, test } from './fixtures'

const noHScroll = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
const png = { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC', 'base64') }

test.describe('HP (Pixel 5)', () => {
  test('login lewat akun demo di layar kecil', async ({ page }) => {
    await page.goto('/login'); await noHScroll(page); await page.locator('.demo-i', { hasText: 'Agus Santoso' }).tap(); await page.locator('button[type=submit]').tap(); await expect(page).toHaveURL('/'); await expect(page.locator('.uchip')).toBeVisible()
  })
  test('daftar: filter cepat bisa digeser, kartu terbaca, tanpa gulir horizontal halaman', async ({ page }) => {
    await seed(page, 'asman', { projects: [projectDoc({ n: 1 }), projectDoc({ n: 2, status: 'Selesai' })] }); await page.goto('/'); await expect(page.locator('.qf-i')).toHaveCount(5); await noHScroll(page)
    await page.locator('.qf-i.final').tap(); await expect(cards(page)).toHaveCount(1); await expect(card(page, 'UJI 2').locator('.paudit')).toBeVisible()
  })
  test('alur: buat project, stepper & panduan terlipat, tombol Kembali/Sebelumnya terbaca', async ({ page }) => {
    await seed(page, 'surveyor'); await createProject(page); await noHScroll(page)
    await expect(page.locator('.steps')).toBeVisible(); await expect(page.locator('.backlink')).toContainText('Kembali'); await expect(page.locator('.stepfoot')).toContainText('Sebelumnya')
    await expect(page.locator('.guide-d')).toBeHidden(); await page.locator('.guide-m summary').tap(); await expect(guideItem(page, 'x').first().or(page.locator('.guide-m .gitem').first())).toBeVisible()
    const box = await page.locator('.rmap').boundingBox(); expect(box.height).toBeGreaterThan(260); expect(box.width).toBeGreaterThan(300)
  })
  test('tagging di HP: titik bertambah dan Lanjut terbuka setelah Selesai', async ({ page }) => {
    await seed(page, 'surveyor'); await createProject(page); await tagPoints(page, 2); await expect(lanjut(page)).toBeDisabled(); await page.locator('.map-bar button', { hasText: 'Selesai' }).tap(); await expect(lanjut(page)).toBeEnabled()
  })
  test('kontrol peta tidak saling menimpa (pencarian, alat, lapisan)', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto('/project/kode0001ab/peta')
    const r = async (s) => page.locator(s).first().boundingBox(); const a = await r('.msearch'), b = await r('.mtools'), c = await r('.map-layer')
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1); expect(c.y).toBeGreaterThanOrEqual(b.y + b.height - 1)
  })
  test('RAB di HP berupa kartu (bukan tabel lebar) dan harga bisa diubah', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto('/project/kode0001ab/rab'); await expect(page.getByTestId('rab-cards')).toBeVisible(); await expect(page.getByTestId('rab-table')).toHaveCount(0); await noHScroll(page)
    const t0 = await page.getByTestId('grand-total').innerText(); await page.getByTestId('harga-input').first().fill('8888888'); await expect(page.getByTestId('grand-total')).not.toHaveText(t0)
    await page.getByTestId('slo-switch').tap(); await expect(page.getByTestId('slo-switch')).toHaveAttribute('aria-checked', 'false')
  })
  test('RAB KHS di HP: peringatan terkunci dan baris merah', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc({ rabOpt: { harga: 'KHS', jenis: 'Total', asal: 'Gudang UP3', slo: true } })] }); await page.goto('/project/kode0001ab/rab'); await expect(page.locator('.alert.bad')).toContainText('terkunci'); await expect(page.locator('.rc.nohrg').first()).toBeVisible()
  })
  test('foto: pratinjau besar dapat dibuka dan ditutup di HP', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc({ foto: [] })] }); await page.goto('/project/kode0001ab/ekspor'); await page.setInputFiles('input[type=file]', png)
    const th = page.locator('.photos .ph:not(.add)'); await expect(th).toHaveCount(1); await th.tap(); const lb = page.locator('.lb'); await expect(lb).toBeVisible()
    const b = await page.locator('.lb-img').boundingBox(); expect(b.width).toBeLessThanOrEqual(394); await page.getByRole('button', { name: 'Tutup' }).tap(); await expect(lb).toHaveCount(0)
  })
  test('pop-up konfirmasi Kembali muat di layar dan tombolnya bisa dijangkau', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto('/project/kode0001ab/data'); await page.locator('.backlink').tap(); const m = page.locator('.modal'); await expect(m).toBeVisible()
    const b = await m.boundingBox(), vp = page.viewportSize(); expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(vp.width); expect(b.y + b.height).toBeLessThanOrEqual(vp.height)
    await m.getByRole('button', { name: 'Simpan sebagai Draft & keluar' }).tap(); await expect(page).toHaveURL('/')
  })
  test('pop-up hapus di HP', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); await page.goto('/'); await page.getByRole('button', { name: /Hapus project/ }).tap(); await expect(page.locator('.modal')).toContainText('tidak dapat dibatalkan')
  })
  test('menu pengguna & keluar di HP', async ({ page }) => {
    await login(page, 'asman'); await page.locator('.uchip').tap(); await expect(page.locator('.upop')).toBeVisible(); const b = await page.locator('.upop').boundingBox(); expect(b.x).toBeGreaterThanOrEqual(0); await page.getByRole('button', { name: 'Keluar' }).tap(); await expect(page).toHaveURL(/\/login/)
  })
  test('tidak ada gulir horizontal di halaman utama langkah', async ({ page }) => {
    await seed(page, 'surveyor', { projects: [projectDoc()] }); for (const s of ['data', 'peta', 'gambar', 'ekspor']) { await page.goto(`/project/kode0001ab/${s}`); await noHScroll(page) }
  })
})
