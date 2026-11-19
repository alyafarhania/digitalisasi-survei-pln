import { describe, expect, it } from 'vitest'
import { BATAS_SUDUT_DALAM, isTajamPoint, sudutDalam } from '../../src/lib/tajam.js'

describe('belokan tajam = sudut dalam < 90°', () => {
  it('batas 90°', () => expect(BATAS_SUDUT_DALAM).toBe(90))
  it('sudut dalam = 180 - sudut belokan', () => { expect(sudutDalam({ sudut: 0 })).toBe(180); expect(sudutDalam({ sudut: 60 })).toBe(120); expect(sudutDalam({ sudut: 135 })).toBe(45) })
  it('sudut belum dihitung dianggap lurus', () => expect(sudutDalam({})).toBe(180))
  it('lurus dan belokan landai tidak tajam', () => { for (const s of [0, 10, 45, 60, 89]) expect(isTajamPoint({}, { sudut: s })).toBe(false) })
  it('tepat 90° (siku) belum dianggap tajam', () => expect(isTajamPoint({}, { sudut: 90 })).toBe(false))
  it('belokan > 90° tajam (sudut dalam < 90°)', () => { for (const s of [91, 120, 170]) expect(isTajamPoint({}, { sudut: s })).toBe(true) })
})
