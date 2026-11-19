import { describe, expect, it } from 'vitest'
import { ATURAN, C_BARU, C_BONGKAR, C_EKS, SIMBOL, colorOfStatus, garisSimbol, ikonSvg, matchAturan, symMarkup } from '../../src/lib/shared/symbols.js'

const A = ATURAN.map(([sumber, pola, simbol, prioritas]) => ({ sumber, pola, simbol, prioritas }))
describe('simbol gambar', () => {
  it('13 simbol legenda', () => expect(SIMBOL).toHaveLength(13))
  it('warna menurut status: baru merah, eksisting ungu, bongkar abu-abu', () => { expect(colorOfStatus('baru')).toBe(C_BARU); expect(colorOfStatus('eksisting')).toBe(C_EKS); expect(colorOfStatus('bongkar')).toBe(C_BONGKAR) })
  it('setiap simbol menghasilkan markup untuk tiga status', () => { for (const [k] of SIMBOL) for (const s of ['baru', 'eksisting', 'bongkar']) expect(symMarkup(k, s).length, `${k}/${s}`).toBeGreaterThan(10) })
  it('markup memakai warna status', () => { expect(symMarkup('tiangBeton', 'baru')).toContain(C_BARU); expect(symMarkup('tiangBeton', 'eksisting')).toContain(C_EKS) })
  it('tiang yang dibongkar digambar sebagai lingkaran silang abu-abu', () => expect(symMarkup('trafo3', 'bongkar')).toContain(C_BONGKAR))
  it('ikonSvg membungkus dalam <svg>', () => expect(ikonSvg('fco', 'baru')).toMatch(/^<svg .*<\/svg>$/))
})
describe('aturan atribut -> simbol', () => {
  it.each([['tiang', 'Tiang Besi 11M-350', 'tiangBesi'], ['tiang', 'Tiang Beton 12M-350 daN+E', 'tiangBeton'], ['peralatan', 'Trafo 1 phasa 50 kVA', 'trafo1'], ['peralatan', 'Trafo 3 phasa 100 kVA YNyn0', 'trafo3'],
    ['peralatan', 'Fuse Cut Out 24 kV', 'fco'], ['peralatan', 'ABSW 20 kV', 'absw'], ['konstruksi', 'KONSTRUKSI VANGNET', 'vang']])('%s "%s" -> %s', (s, t, hasil) => expect(matchAturan(A, s, t)).toBe(hasil))
  it('tanpa kecocokan = null', () => { expect(matchAturan(A, 'peralatan', 'Kabel apa saja')).toBeNull(); expect(matchAturan(A, 'peralatan', '')).toBeNull(); expect(matchAturan(A, 'peralatan', undefined)).toBeNull() })
  it('prioritas kecil dicoba lebih dulu', () => expect(matchAturan([{ sumber: 'x', pola: '.*', simbol: 'b', prioritas: 99 }, { sumber: 'x', pola: 'abc', simbol: 'a', prioritas: 1 }], 'x', 'abc')).toBe('a'))
})
describe('garisSimbol', () => {
  it.each([['JTM', 3, 'jtm3'], ['JTM', 1, 'jtm1'], ['JTR', 1, 'jtr1'], ['JTR', 3, 'jtr3']])('%s %i fasa -> %s', (k, f, s) => expect(garisSimbol(k, f)).toBe(s))
})
