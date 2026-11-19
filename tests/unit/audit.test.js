import { describe, expect, it } from 'vitest'
import { ACTION, actorOf, auditEntry, auditSummary, fmtWaktu } from '../../src/lib/audit.js'

const U = { id: 'u1', name: 'Agus', role: 'surveyor', email: 'a@x', password: 'rahasia' }
describe('audit', () => {
  it('actorOf hanya memuat id, nama, peran (tanpa email/sandi)', () => expect(actorOf(U)).toEqual({ id: 'u1', name: 'Agus', role: 'surveyor' }))
  it('tanpa pengguna = Sistem', () => expect(actorOf(null).name).toBe('Sistem'))
  it('auditEntry mengisi id, waktu ISO, pelaku, catatan', () => {
    const e = auditEntry('finalized', U, 'catatan')
    expect(e).toMatchObject({ action: 'finalized', by: { id: 'u1' }, note: 'catatan' }); expect(e.id).toBeTruthy(); expect(new Date(e.at).toISOString()).toBe(e.at)
  })
  it('catatan kosong tidak ditulis', () => expect('note' in auditEntry('created', U)).toBe(false))
  it('setiap aksi punya label', () => { for (const k of ['created', 'copied', 'finalized', 'reopened', 'deleted']) expect(ACTION[k].label).toBeTruthy() })
  it('auditSummary: dibuat, difinalisasi (hanya bila Final), terakhir diubah', () => {
    const base = { createdBy: { name: 'A' }, createdAt: '2026-01-01T00:00:00Z', lastEditedBy: { name: 'B' }, lastEditedAt: '2026-01-02T00:00:00Z', finalizedBy: { name: 'C' }, finalizedAt: '2026-01-03T00:00:00Z' }
    expect(auditSummary({ ...base, status: 'Draft' }).finalized).toBeNull()
    const s = auditSummary({ ...base, status: 'Selesai' })
    expect(s.created.by).toBe('A'); expect(s.finalized.by).toBe('C'); expect(s.edited.by).toBe('B')
  })
  it('project lama tanpa data audit tidak error', () => expect(auditSummary({ status: 'Draft' })).toEqual({ created: null, finalized: null, edited: null }))
  it('fmtWaktu', () => { expect(fmtWaktu('')).toBe(''); expect(fmtWaktu('2026-11-19T10:21:00Z')).toMatch(/2026/) })
})
