import { describe, expect, it } from 'vitest'
import { bearing, deflection, dist } from '../../src/lib/shared/geo.js'

const A = { lat: -7.7, lng: 110.6 }
describe('geo.dist', () => {
  it('jarak dua titik yang sama = 0', () => expect(dist(A, A)).toBe(0))
  it('0,001° lintang ≈ 111 m', () => expect(dist(A, { lat: A.lat + 0.001, lng: A.lng })).toBeCloseTo(111.2, 0))
  it('simetris', () => { const B = { lat: -7.71, lng: 110.61 }; expect(dist(A, B)).toBeCloseTo(dist(B, A), 6) })
})
describe('geo.bearing', () => {
  it('utara = 0°', () => expect(bearing(A, { lat: A.lat + 0.01, lng: A.lng })).toBeCloseTo(0, 3))
  it('timur = 90°', () => expect(bearing(A, { lat: A.lat, lng: A.lng + 0.01 })).toBeCloseTo(90, 0))
  it('selatan = 180°', () => expect(bearing(A, { lat: A.lat - 0.01, lng: A.lng })).toBeCloseTo(180, 3))
  it('barat = 270°', () => expect(bearing(A, { lat: A.lat, lng: A.lng - 0.01 })).toBeCloseTo(270, 0))
})
describe('geo.deflection (0° = lurus)', () => {
  const P = (dx, dy) => ({ lat: A.lat + dy, lng: A.lng + dx })
  it('titik ujung tanpa tetangga = 0', () => { expect(deflection(null, A, P(1, 0))).toBe(0); expect(deflection(P(0, 0), A, null)).toBe(0) })
  it('lurus = 0°', () => expect(deflection(P(0, 0), P(0.001, 0), P(0.002, 0))).toBe(0))
  it('belok siku-siku = 90°', () => expect(deflection(P(0, 0), P(0.001, 0), P(0.001, 0.001))).toBe(90))
  it('berbalik arah ≈ 180°', () => expect(deflection(P(0, 0), P(0.001, 0), P(0, 0.00001))).toBeGreaterThan(170))
  it('arah belok tidak mengubah nilai', () => expect(deflection(P(0, 0), P(0.001, 0), P(0.001, 0.001))).toBe(deflection(P(0, 0), P(0.001, 0), P(0.001, -0.001))))
})
