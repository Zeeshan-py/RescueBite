import { describe, expect, it } from 'vitest'
import { calculateDistanceKm, calculateDistanceScoreFromKm, isValidCoordinates, isValidLatitude, isValidLongitude } from './location.utils'

describe('coordinate validation', () => {
  it('validates latitude boundaries', () => { expect(isValidLatitude(-90)).toBe(true); expect(isValidLatitude(90)).toBe(true); expect(isValidLatitude(90.001)).toBe(false) })
  it('validates longitude boundaries', () => { expect(isValidLongitude(-180)).toBe(true); expect(isValidLongitude(180)).toBe(true); expect(isValidLongitude(-180.001)).toBe(false) })
  it('requires a complete valid coordinate pair', () => { expect(isValidCoordinates({ latitude: 31.5204, longitude: 74.3587 })).toBe(true); expect(isValidCoordinates({ latitude: 31.5204 })).toBe(false) })
})

describe('geographic distance', () => {
  it('returns zero for identical coordinates', () => expect(calculateDistanceKm({ latitude: 31.5204, longitude: 74.3587 }, { latitude: 31.5204, longitude: 74.3587 })).toBe(0))
  it('calculates a known nearby Lahore distance', () => expect(calculateDistanceKm({ latitude: 31.5204, longitude: 74.3587 }, { latitude: 31.4697, longitude: 74.2728 })).toBeCloseTo(9.9, 0))
  it('calculates a quarter-circumference distance', () => expect(calculateDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 90 })).toBeCloseTo(Math.PI * 6371 / 2, 8))
  it('rejects invalid coordinates', () => expect(() => calculateDistanceKm({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 })).toThrow(RangeError))
})

describe('distance scoring', () => {
  it.each([[0, 100], [2, 100], [3.2, 90], [8, 75], [15, 50], [25, 25], [31, 0]])('scores %s km as %s', (distance, score) => expect(calculateDistanceScoreFromKm(distance)).toBe(score))
  it('rejects invalid distance', () => expect(() => calculateDistanceScoreFromKm(-1)).toThrow(RangeError))
})
