// Jejak audit per project: dibuat, disalin, difinalisasi, dibuka kembali. "Terakhir diubah" disimpan di field terpisah.
export const ACTION = {
  created: { label: 'Dibuat', tone: 'info' },
  copied: { label: 'Disalin', tone: 'info' },
  finalized: { label: 'Difinalisasi', tone: 'ok' },
  reopened: { label: 'Dibuka kembali (Draft)', tone: 'warn' },
  deleted: { label: 'Dihapus', tone: 'bad' },
}
export const actorOf = (u) => (u ? { id: u.id, name: u.name, role: u.role } : { id: 'system', name: 'Sistem', role: 'system' })
export const auditEntry = (action, user, note) => ({ id: crypto.randomUUID(), action, by: actorOf(user), at: new Date().toISOString(), ...(note ? { note } : {}) })
export const fmtWaktu = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')

// Ringkasan untuk kartu project
export function auditSummary(p) {
  return {
    created: p.createdBy ? { by: p.createdBy.name, at: p.createdAt } : null,
    finalized: p.status === 'Selesai' && p.finalizedBy ? { by: p.finalizedBy.name, at: p.finalizedAt } : null,
    edited: p.lastEditedBy ? { by: p.lastEditedBy.name, at: p.lastEditedAt } : null,
  }
}
