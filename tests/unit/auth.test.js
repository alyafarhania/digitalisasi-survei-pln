import { describe, expect, it } from 'vitest'
import { MOCK_USERS, PERMISSIONS, ROLES, ROLE_KEYS, alasanReadOnly, can, canDeleteProject, canEditProject, mockLogin, publicUser, readSession, writeSession } from '../../src/lib/auth.js'

const U = Object.fromEntries(MOCK_USERS.map((u) => [u.id.replace('u-', ''), publicUser(u)]))
const proj = (over = {}) => ({ id: 'p', status: 'Draft', createdBy: { id: 'u-surveyor' }, ...over })

describe('peran: hanya Surveyor dan Asman/MULP', () => {
  it('daftar peran', () => { expect(ROLE_KEYS).toEqual(['surveyor', 'asman']); expect(ROLES.asman.label).toBe('Asman/MULP'); expect(ROLES.surveyor.label).toBe('Surveyor') })
  it('semua akun demo memakai salah satu dari dua peran', () => { for (const u of MOCK_USERS) expect(ROLE_KEYS).toContain(u.role) })
  it('setiap peran punya izin', () => { for (const r of ROLE_KEYS) expect(PERMISSIONS[r].length).toBeGreaterThan(0) })
})
describe('RBAC: matriks izin', () => {
  it('surveyor: membuat, mengubah, ekspor; tidak finalisasi/buka kembali/audit', () => {
    for (const k of ['project:create', 'project:edit', 'project:export']) expect(can(U.surveyor, k)).toBe(true)
    for (const k of ['project:finalize', 'project:reopen', 'audit:view', 'project:edit:any']) expect(can(U.surveyor, k)).toBe(false)
  })
  it('asman/MULP: finalisasi, buka kembali, koreksi, ekspor, audit; tidak membuat/menghapus', () => {
    for (const k of ['project:finalize', 'project:reopen', 'project:edit:any', 'project:export', 'audit:view']) expect(can(U.asman, k)).toBe(true)
    for (const k of ['project:create', 'project:delete']) expect(can(U.asman, k)).toBe(false)
  })
  it('tanpa pengguna tidak punya izin apa pun', () => { expect(can(null, 'project:create')).toBe(false); expect(can(undefined, 'audit:view')).toBe(false) })
  it('izin tak dikenal ditolak', () => expect(can(U.asman, 'sistem:hancurkan')).toBe(false))
})
describe('canEditProject', () => {
  it('surveyor mengubah project buatan sendiri', () => expect(canEditProject(U.surveyor, proj())).toBe(true))
  it('surveyor lain tidak boleh mengubah', () => expect(canEditProject(U.surveyor2, proj())).toBe(false))
  it('asman/MULP mengoreksi project siapa pun', () => expect(canEditProject(U.asman, proj())).toBe(true))
  it('project Final terkunci untuk semua peran', () => { for (const r of Object.keys(U)) expect(canEditProject(U[r], proj({ status: 'Selesai' }))).toBe(false) })
  it('project lama tanpa pembuat bisa diubah surveyor', () => expect(canEditProject(U.surveyor, proj({ createdBy: undefined }))).toBe(true))
  it('tanpa pengguna/project = false', () => { expect(canEditProject(null, proj())).toBe(false); expect(canEditProject(U.asman, null)).toBe(false) })
})
describe('canDeleteProject', () => {
  it('surveyor hanya menghapus draft buatan sendiri', () => { expect(canDeleteProject(U.surveyor, proj())).toBe(true); expect(canDeleteProject(U.surveyor, proj({ status: 'Selesai' }))).toBe(false); expect(canDeleteProject(U.surveyor2, proj())).toBe(false) })
  it('asman/MULP tidak menghapus', () => expect(canDeleteProject(U.asman, proj())).toBe(false))
})
describe('alasanReadOnly', () => {
  it('null bila boleh mengubah', () => expect(alasanReadOnly(U.surveyor, proj())).toBeNull())
  it('menyebut project Final', () => expect(alasanReadOnly(U.asman, proj({ status: 'Selesai' }))).toMatch(/Final/))
  it('menyebut pembuat project untuk surveyor lain', () => expect(alasanReadOnly(U.surveyor2, proj({ createdBy: { id: 'u-surveyor', name: 'Agus' } }))).toMatch(/Agus/))
})
describe('login mock & sesi', () => {
  it('login benar mengembalikan pengguna tanpa kata sandi', async () => { const r = await mockLogin('ASMAN@pln.test ', 'asman123', 'asman'); expect(r.ok).toBe(true); expect(r.user.role).toBe('asman'); expect('password' in r.user).toBe(false) })
  it('peran yang dipilih harus cocok dengan akun', async () => { const r = await mockLogin('asman@pln.test', 'asman123', 'surveyor'); expect(r.ok).toBe(false); expect(r.error).toMatch(/Asman\/MULP/) })
  it('tanpa pilihan peran tetap bisa masuk (kompatibel)', async () => expect((await mockLogin('surveyor@pln.test', 'surveyor123')).ok).toBe(true))
  it('sandi salah ditolak', async () => { const r = await mockLogin('asman@pln.test', 'salah', 'asman'); expect(r.ok).toBe(false); expect(r.error).toMatch(/salah/) })
  it('email tidak terdaftar ditolak', async () => expect((await mockLogin('x@y.z', 'apa saja')).ok).toBe(false))
  it('sesi tersimpan dan terhapus', () => { expect(readSession()).toBeNull(); writeSession(U.asman); expect(readSession().id).toBe('u-asman'); writeSession(null); expect(readSession()).toBeNull() })
  it('sesi lama dengan peran yang sudah dihapus dianggap keluar', () => { writeSession({ id: 'u-admin', role: 'admin', name: 'Lama' }); expect(readSession()).toBeNull() })
  it('sesi rusak tidak melempar error', () => { localStorage.setItem('pln-session-v1', '{rusak'); expect(readSession()).toBeNull() })
  it('semua akun demo unik', () => { expect(new Set(MOCK_USERS.map((u) => u.email)).size).toBe(MOCK_USERS.length); expect(new Set(MOCK_USERS.map((u) => u.id)).size).toBe(MOCK_USERS.length) })
})
