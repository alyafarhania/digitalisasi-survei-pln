// Autentikasi + RBAC TIRUAN (tahap UI). Kata sandi disimpan polos di kode hanya untuk mock;
// backend nyata harus memakai hash + sesi/token (lihat docs/api_documentation.md).
// Hanya dua peran: Surveyor (melakukan survei) dan Asman/MULP (memfinalisasi hasil survei).
export const ROLES = {
  surveyor: { label: 'Surveyor', desc: 'Melakukan survei: membuat project, menandai titik di peta, mengisi konstruksi dan gambar. Hanya mengubah project buatan sendiri.' },
  asman: { label: 'Asman/MULP', desc: 'Memeriksa dan memfinalisasi hasil survei: dapat membuka semua project, mengoreksi, finalisasi, membuka kembali, ekspor, dan melihat riwayat.' },
}
export const ROLE_KEYS = Object.keys(ROLES)

// Matriks izin (kunci = peran)
export const PERMISSIONS = {
  surveyor: ['project:create', 'project:edit', 'project:delete:own', 'project:export'],
  asman: ['project:edit', 'project:edit:any', 'project:finalize', 'project:reopen', 'project:export', 'audit:view'],
}

export const MOCK_USERS = [
  { id: 'u-surveyor', email: 'surveyor@pln.test', password: 'surveyor123', name: 'Agus Santoso', role: 'surveyor' },
  { id: 'u-surveyor2', email: 'surveyor2@pln.test', password: 'surveyor123', name: 'Siti Rahmawati', role: 'surveyor' },
  { id: 'u-asman', email: 'asman@pln.test', password: 'asman123', name: 'Bagus Prasetyo', role: 'asman' },
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
// Sesi lama dengan peran yang sudah dihapus (admin/perencana/manajer) dianggap tidak berlaku: pengguna masuk ulang.
export const readSession = () => { try { const u = JSON.parse(localStorage.getItem(SESSION) || 'null'); return u && ROLES[u.role] ? u : null } catch { return null } }
export const writeSession = (u) => { try { u ? localStorage.setItem(SESSION, JSON.stringify(u)) : localStorage.removeItem(SESSION) } catch { /* abaikan */ } }

// role (opsional) = peran yang dipilih di halaman masuk; akun harus cocok dengan peran itu.
export async function mockLogin(email, password, role) {
  await new Promise((r) => setTimeout(r, 450)) // meniru latensi jaringan
  const u = MOCK_USERS.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase() && x.password === password)
  if (!u) return { ok: false, error: 'Email atau kata sandi salah.' }
  if (role && u.role !== role) return { ok: false, error: `Akun ini terdaftar sebagai ${ROLES[u.role].label}. Pilih peran ${ROLES[u.role].label} lalu masuk lagi.` }
  return { ok: true, user: publicUser(u) }
}
