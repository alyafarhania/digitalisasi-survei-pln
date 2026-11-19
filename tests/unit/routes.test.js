import { describe, expect, it } from 'vitest'
import { parseRoute, pathFor, STEP_PATHS } from '../../src/lib/routes.js'

const K = 'abcdefgh12'
describe('parseRoute', () => {
  it('beranda', () => { expect(parseRoute('/')).toEqual({ page: 'project' }); expect(parseRoute('')).toEqual({ page: 'project' }) })
  it('halaman statis', () => { expect(parseRoute('/offline')).toEqual({ page: 'offline' }); expect(parseRoute('/login')).toEqual({ page: 'login' }) })
  it('project baru', () => expect(parseRoute('/project/baru')).toEqual({ page: 'data', opt: 'baru' }))
  it.each(STEP_PATHS)('langkah %s', (s) => expect(parseRoute(`/project/${K}/${s}`)).toEqual({ page: s, kode: K }))
  it('garis miring di akhir diabaikan', () => expect(parseRoute(`/project/${K}/peta/`)).toEqual({ page: 'peta', kode: K }))
  it('/project/<kode> diarahkan ke langkah data', () => expect(parseRoute(`/project/${K}`)).toEqual({ page: 'data', kode: K, redirect: true }))
  it('alamat tidak dikenal', () => { for (const p of ['/ngawur', '/project', `/project/${K}/xyz`, '/project/pendek/peta', '/project//peta']) expect(parseRoute(p).page).toBe('notfound') })
})
describe('pathFor', () => {
  it('halaman utama', () => { expect(pathFor('project')).toBe('/'); expect(pathFor('offline')).toBe('/offline'); expect(pathFor('login')).toBe('/login') })
  it('project baru', () => expect(pathFor('data', { opt: 'baru' })).toBe('/project/baru'))
  it('langkah memakai kode', () => expect(pathFor('rab', { kode: K })).toBe(`/project/${K}/rab`))
  it('langkah tanpa kode kembali ke beranda', () => expect(pathFor('peta', {})).toBe('/'))
  it('bolak-balik parse <-> path', () => { for (const s of STEP_PATHS) expect(parseRoute(pathFor(s, { kode: K }))).toMatchObject({ page: s, kode: K }) })
})
