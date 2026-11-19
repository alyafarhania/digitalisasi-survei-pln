import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

afterEach(() => cleanup())

// fetch('/mock/master.json') membaca berkas sungguhan agar uji memakai data master asli
const master = readFileSync(resolve(process.cwd(), 'public/mock/master.json'), 'utf8')
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).includes('/mock/master.json')) return { ok: true, json: async () => JSON.parse(master) }
    return { ok: false, status: 404, json: async () => ({}) }
  }))
})
