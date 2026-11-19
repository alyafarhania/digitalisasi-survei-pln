import { defineConfig } from 'vitest/config'
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: { environment: 'jsdom', include: ['tests/unit/**/*.test.{js,jsx}'], setupFiles: ['tests/unit/setup.js'], restoreMocks: true, testTimeout: 15000 },
})
