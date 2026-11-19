import { USERS, expect, login, logout, test } from './fixtures'

test.describe('Login & sesi (mock)', () => {
  test('tanpa sesi, semua alamat dialihkan ke /login dengan ?next', async ({ page }) => {
    await page.goto('/'); await expect(page).toHaveURL(/\/login\?next=%2F$/)
    await page.goto('/project/abcdefgh12/peta'); await expect(page).toHaveURL(/\/login\?next=%2Fproject%2Fabcdefgh12%2Fpeta/)
  })
  test('halaman login menampilkan form dan akun demo', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible(); await expect(page.locator('.demo-i')).toHaveCount(5)
    await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeDisabled()
  })
  test('kata sandi salah menampilkan galat dan tetap di halaman login', async ({ page }) => {
    await page.goto('/login'); await page.locator('input[type=email]').fill('surveyor@pln.test'); await page.locator('input[type=password]').fill('salah'); await page.locator('button[type=submit]').click()
    await expect(page.locator('.alert.bad')).toContainText('Email atau kata sandi salah'); await expect(page).toHaveURL(/\/login/)
  })
  test('email tidak terdaftar ditolak', async ({ page }) => {
    await page.goto('/login'); await page.locator('input[type=email]').fill('x@y.z'); await page.locator('input[type=password]').fill('abc'); await page.locator('button[type=submit]').click()
    await expect(page.locator('.alert.bad')).toBeVisible()
  })
  test('ketuk akun demo mengisi form', async ({ page }) => {
    await page.goto('/login'); await page.locator('.demo-i', { hasText: 'Bagus Prasetyo' }).click()
    await expect(page.locator('input[type=email]')).toHaveValue('perencana@pln.test'); await expect(page.locator('input[type=password]')).toHaveValue('perencana123')
  })
  test('tombol tampilkan/sembunyikan kata sandi', async ({ page }) => {
    await page.goto('/login'); const p = page.locator('.pwd input'); await p.fill('rahasia'); await expect(p).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'Tampilkan kata sandi' }).click(); await expect(p).toHaveAttribute('type', 'text')
  })
  for (const who of ['admin', 'perencana', 'surveyor', 'manajer']) {
    test(`masuk sebagai ${who}: nama dan peran tampil di header`, async ({ page }) => {
      await login(page, who); await expect(page).toHaveURL('/')
      await expect(page.locator('.uchip')).toContainText(USERS[who].name); await expect(page.locator('.uchip')).toContainText(USERS[who].label)
    })
  }
  test('setelah login kembali ke alamat tujuan (?next)', async ({ page }) => {
    await login(page, 'surveyor', '/offline'); await expect(page).toHaveURL('/offline'); await expect(page.getByRole('heading', { name: 'Offline & Sinkron' })).toBeVisible()
  })
  test('?next ke situs luar diabaikan', async ({ page }) => {
    await login(page, 'surveyor', '//evil.example.com'); await expect(page).toHaveURL('/')
  })
  test('sesi bertahan setelah reload', async ({ page }) => {
    await login(page, 'perencana'); await page.reload(); await expect(page.locator('.uchip')).toContainText('Bagus Prasetyo'); await expect(page).toHaveURL('/')
  })
  test('keluar mengakhiri sesi dan melindungi alamat', async ({ page }) => {
    await login(page, 'admin'); await logout(page); await page.goto('/'); await expect(page).toHaveURL(/\/login/)
  })
  test('sudah masuk lalu buka /login: dialihkan ke beranda', async ({ page }) => {
    await login(page, 'admin'); await page.goto('/login'); await expect(page).toHaveURL('/')
  })
  test('menu pengguna menjelaskan hak peran', async ({ page }) => {
    await login(page, 'manajer'); await page.locator('.uchip').click(); await expect(page.locator('.upop')).toContainText('Hanya melihat')
  })
})
