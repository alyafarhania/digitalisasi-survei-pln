// Autentikasi + RBAC TIRUAN (tahap UI). Kata sandi disimpan polos di kode hanya untuk mock;
// backend nyata harus memakai hash + sesi/token (lihat docs/api_documentation.md).
export const ROLES = {
  admin: { label: 'Admin UP3', desc: 'Kelola semua project, hapus, finalisasi, lihat riwayat audit' },
  perencana: { label: 'Perencana', desc: 'Ubah semua project, finalisasi dan buka kembali, ekspor' },
  surveyor: { label: 'Surveyor', desc: 'Buat project, ubah project buatan sendiri, ekspor' },
  manajer: { label: 'Manajer', desc: 'Hanya melihat, ekspor, dan melihat riwayat' },
}

// Matriks izin (kunci = peran)
export const PERMISSIONS = {
  admin: ['project:create', 'project:edit', 'project:edit:any', 'project:finalize', 'project:reopen', 'project:delete', 'project:export', 'audit:view'],
  perencana: ['project:create', 'project:edit', 'project:edit:any', 'project:finalize', 'project:reopen', 'project:export', 'audit:view'],
  surveyor: ['project:create', 'project:edit', 'project:delete:own', 'project:export'],
  manajer: ['project:export', 'audit:view'],
}

export const MOCK_USERS = [
  { id: 'u-admin', email: 'admin@pln.test', password: 'admin123', name: 'Dewi Kartika', role: 'admin' },
  { id: 'u-perencana', email: 'perencana@pln.test', password: 'perencana123', name: 'Bagus Prasetyo', role: 'perencana' },
  { id: 'u-surveyor', email: 'surveyor@pln.test', password: 'surveyor123', name: 'Agus Santoso', role: 'surveyor' },
  { id: 'u-surveyor2', email: 'surveyor2@pln.test', password: 'surveyor123', name: 'Siti Rahmawati', role: 'surveyor' },
  { id: 'u-manajer', email: 'manajer@pln.test', password: 'manajer123', name: 'Hendra Wijaya', role: 'manajer' },
]

export const can = (user, perm) => !!user && (PERMISSIONS[user.role] || []).includes(perm)
const own = (user, p) => !p?.createdBy || p.createdBy.id === user?.id

// Project final dikunci untuk semua peran sampai dibuka kembali (Draft)
export function canEditProject(user, p) {
  if (!user || !p || p.status === 'Selesai') return false
  return can(user, 'project:edit:any') || (can(user, 'project:edit') && own(user, p))
}
export const canDeleteProject = (user, p) => !!user && !!p && (can(user, 'project:delete') || (can(user, 'project:delete:own') && own(user, p) && p.status !== 'Selesai'))
// Alasan project tidak bisa diubah (untuk spanduk "lihat saja")
export function alasanReadOnly(user, p) {
  if (!user || !p) return null
  if (p.status === 'Selesai') return 'Project sudah Final dan dikunci.'
  if (canEditProject(user, p)) return null
  if (!can(user, 'project:edit')) return `Peran ${ROLES[user.role]?.label} hanya dapat melihat project.`
  return `Project ini dibuat oleh ${p.createdBy?.name || 'pengguna lain'}; peran ${ROLES[user.role]?.label} hanya boleh mengubah project buatan sendiri.`
}

export const publicUser = ({ password, ...u }) => u
const SESSION = 'pln-session-v1'
export const readSession = () => { try { return JSON.parse(localStorage.getItem(SESSION) || 'null') } catch { return null } }
export const writeSession = (u) => { try { u ? localStorage.setItem(SESSION, JSON.stringify(u)) : localStorage.removeItem(SESSION) } catch { /* abaikan */ } }

export async function mockLogin(email, password) {
  await new Promise((r) => setTimeout(r, 450)) // meniru latensi jaringan
  const u = MOCK_USERS.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase() && x.password === password)
  return u ? { ok: true, user: publicUser(u) } : { ok: false, error: 'Email atau kata sandi salah.' }
}
