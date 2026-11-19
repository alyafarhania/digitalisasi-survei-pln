import { describe, expect, it } from 'vitest'
import { MOCK_USERS, PERMISSIONS, ROLES, alasanReadOnly, can, canDeleteProject, canEditProject, mockLogin, publicUser, readSession, writeSession } from '../../src/lib/auth.js'

const U = Object.fromEntries(MOCK_USERS.map((u) => [u.id.replace('u-', ''), publicUser(u)]))
const proj = (over = {}) => ({ id: 'p', status: 'Draft', createdBy: { id: 'u-surveyor' }, ...over })

describe('RBAC: matriks izin', () => {
  it('setiap peran terdaftar dan punya izin', () => { for (const r of Object.keys(ROLES)) expect(PERMISSIONS[r].length).toBeGreaterThan(0) })
  it('hanya admin boleh menghapus project mana pun', () => { expect(can(U.admin, 'project:delete')).toBe(true); for (const r of ['perencana', 'surveyor', 'manajer']) expect(can(U[r], 'project:delete')).toBe(false) })
  it('finalisasi: admin & perencana saja', () => { expect(can(U.admin, 'project:finalize')).toBe(true); expect(can(U.perencana, 'project:finalize')).toBe(true); expect(can(U.surveyor, 'project:finalize')).toBe(false); expect(can(U.manajer, 'project:finalize')).toBe(false) })
  it('buka kembali: admin & perencana saja', () => { expect(can(U.perencana, 'project:reopen')).toBe(true); expect(can(U.surveyor, 'project:reopen')).toBe(false) })
  it('manajer hanya lihat, ekspor, audit', () => { expect(PERMISSIONS.manajer).toEqual(['project:export', 'audit:view']); expect(can(U.manajer, 'project:create')).toBe(false) })
  it('surveyor boleh membuat dan ekspor, tidak lihat audit', () => { expect(can(U.surveyor, 'project:create')).toBe(true); expect(can(U.surveyor, 'project:export')).toBe(true); expect(can(U.surveyor, 'audit:view')).toBe(false) })
  it('tanpa pengguna tidak punya izin apa pun', () => { expect(can(null, 'project:create')).toBe(false); expect(can(undefined, 'audit:view')).toBe(false) })
  it('izin tak dikenal ditolak', () => expect(can(U.admin, 'sistem:hancurkan')).toBe(false))
})
describe('canEditProject', () => {
  it('surveyor mengubah project buatan sendiri', () => expect(canEditProject(U.surveyor, proj())).toBe(true))
  it('surveyor lain tidak boleh mengubah', () => expect(canEditProject(U.surveyor2, proj())).toBe(false))
  it('perencana & admin mengubah project siapa pun', () => { expect(canEditProject(U.perencana, proj())).toBe(true); expect(canEditProject(U.admin, proj())).toBe(true) })
  it('manajer tidak bisa mengubah', () => expect(canEditProject(U.manajer, proj())).toBe(false))
  it('project Final terkunci untuk semua peran', () => { for (const r of Object.keys(U)) expect(canEditProject(U[r], proj({ status: 'Selesai' }))).toBe(false) })
  it('project lama tanpa pembuat bisa diubah surveyor', () => expect(canEditProject(U.surveyor, proj({ createdBy: undefined }))).toBe(true))
  it('tanpa pengguna/project = false', () => { expect(canEditProject(null, proj())).toBe(false); expect(canEditProject(U.admin, null)).toBe(false) })
})
describe('canDeleteProject', () => {
  it('admin menghapus apa saja, termasuk Final', () => { expect(canDeleteProject(U.admin, proj())).toBe(true); expect(canDeleteProject(U.admin, proj({ status: 'Selesai' }))).toBe(true) })
  it('surveyor hanya menghapus draft buatan sendiri', () => { expect(canDeleteProject(U.surveyor, proj())).toBe(true); expect(canDeleteProject(U.surveyor, proj({ status: 'Selesai' }))).toBe(false); expect(canDeleteProject(U.surveyor2, proj())).toBe(false) })
  it('perencana dan manajer tidak boleh menghapus', () => { expect(canDeleteProject(U.perencana, proj())).toBe(false); expect(canDeleteProject(U.manajer, proj())).toBe(false) })
})
describe('alasanReadOnly', () => {
  it('null bila boleh mengubah', () => expect(alasanReadOnly(U.surveyor, proj())).toBeNull())
  it('menyebut project Final', () => expect(alasanReadOnly(U.admin, proj({ status: 'Selesai' }))).toMatch(/Final/))
  it('menyebut peran manajer hanya lihat', () => expect(alasanReadOnly(U.manajer, proj())).toMatch(/hanya dapat melihat/))
  it('menyebut pembuat project untuk surveyor lain', () => expect(alasanReadOnly(U.surveyor2, proj({ createdBy: { id: 'u-surveyor', name: 'Agus' } }))).toMatch(/Agus/))
})
describe('login mock & sesi', () => {
  it('login benar mengembalikan pengguna tanpa kata sandi', async () => { const r = await mockLogin('ADMIN@pln.test ', 'admin123'); expect(r.ok).toBe(true); expect(r.user.role).toBe('admin'); expect('password' in r.user).toBe(false) })
  it('sandi salah ditolak', async () => { const r = await mockLogin('admin@pln.test', 'salah'); expect(r.ok).toBe(false); expect(r.error).toMatch(/salah/) })
  it('email tidak terdaftar ditolak', async () => expect((await mockLogin('x@y.z', 'apa saja')).ok).toBe(false))
  it('sesi tersimpan dan terhapus', () => { expect(readSession()).toBeNull(); writeSession(U.admin); expect(readSession().id).toBe('u-admin'); writeSession(null); expect(readSession()).toBeNull() })
  it('sesi rusak tidak melempar error', () => { localStorage.setItem('pln-session-v1', '{rusak'); expect(readSession()).toBeNull() })
  it('semua akun demo unik', () => { expect(new Set(MOCK_USERS.map((u) => u.email)).size).toBe(MOCK_USERS.length); expect(new Set(MOCK_USERS.map((u) => u.id)).size).toBe(MOCK_USERS.length) })
})
