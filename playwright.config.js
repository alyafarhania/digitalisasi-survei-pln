import { defineConfig, devices } from '@playwright/test'

// Uji end-to-end. Bawaan: menyalakan `next dev` di :3100. Untuk menguji server yang sudah jalan (mis. Docker):
//   E2E_BASE_URL=http://localhost:8080 npx playwright test
const external = process.env.E2E_BASE_URL
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: external || 'http://localhost:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure', acceptDownloads: true },
  projects: [
    { name: 'desktop', testIgnore: /mobile\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 800 } } },
    { name: 'mobile', testMatch: /mobile\.spec/, use: { ...devices['Pixel 5'] } },
  ],
  webServer: external ? undefined : { command: 'npx next dev -p 3100', url: 'http://localhost:3100/api/health', reuseExistingServer: true, timeout: 180_000 },
})
