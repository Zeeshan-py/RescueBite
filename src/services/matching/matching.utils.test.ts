import { describe, expect, it } from 'vitest'
import type { Donation, NGO } from '../../types/domain'
import {
  calculateAvailabilityScore,
  calculateCapacityScore,
  calculateCompatibilityScore,
  calculateDistanceScore,
  calculateMatchingScore,
  calculateUrgencyScore,
  canGenerateMatches,
  rankEligibleNgos,
} from './matching.utils'

const now = new Date('2026-09-28T10:00:00Z')
const donation: Donation = { id: 'd1', donor_id: 'donor', food_type: 'Cooked Food', quantity: 20, meal_portions: 40, location: 'Gulberg, Lahore', available_from: '2026-09-28T09:00:00Z', collection_deadline: '2026-09-28T14:00:00Z', safety_information: null, description: null, status: 'POSTED', created_at: now.toISOString(), updated_at: now.toISOString() }
const ngo = (overrides: Partial<NGO> = {}): NGO => ({ id: 'n1', user_id: 'ngo-user', organization_name: 'Community Support', description: null, location: 'Gulberg, Lahore', capacity: 80, accepted_food_types: ['Cooked Food'], contact_information: null, created_at: now.toISOString(), ...overrides })

describe('matching scores', () => {
  it('uses the documented weights', () => expect(calculateMatchingScore({ distanceScore: 80, urgencyScore: 90, compatibilityScore: 100, capacityScore: 90, availabilityScore: 80 })).toBe(88))
  it('uses only exact textual locations or a neutral fallback', () => { expect(calculateDistanceScore('Gulberg, Lahore', 'gulberg lahore')).toBe(100); expect(calculateDistanceScore('Gulberg', 'Johar Town')).toBe(50) })
  it('increases urgency as the deadline approaches', () => { expect(calculateUrgencyScore('2026-09-28T11:00:00Z', now)).toBe(100); expect(calculateUrgencyScore('2026-09-30T11:00:00Z', now)).toBe(25); expect(calculateUrgencyScore('2026-09-28T09:00:00Z', now)).toBe(0) })
  it('scores exact and general food acceptance', () => { expect(calculateCompatibilityScore('Cooked Food', ['cooked'])).toBe(100); expect(calculateCompatibilityScore('Bakery', ['All Food Types'])).toBe(80); expect(calculateCompatibilityScore('Bakery', ['Vegetables'])).toBe(0) })
  it('scores capacity headroom and rejects insufficient capacity', () => { expect(calculateCapacityScore(40, 40)).toBe(50); expect(calculateCapacityScore(40, 80)).toBe(100); expect(calculateCapacityScore(40, 39)).toBe(0) })
  it('uses the documented availability baseline', () => expect(calculateAvailabilityScore()).toBe(70))
})

describe('matching eligibility and ranking', () => {
  it('ranks eligible NGOs by final score', () => {
    const results = rankEligibleNgos(donation, [ngo({ id: 'far', organization_name: 'Far', location: 'Other', capacity: 40 }), ngo({ id: 'near', organization_name: 'Near' })], now)
    expect(results.map((result) => result.ngoId)).toEqual(['near', 'far'])
  })
  it('excludes incompatible, insufficient, and donor-owned NGOs', () => {
    const results = rankEligibleNgos(donation, [ngo({ id: 'bad-food', accepted_food_types: ['Bakery'] }), ngo({ id: 'small', capacity: 20 }), ngo({ id: 'self', user_id: 'donor' })], now)
    expect(results).toEqual([])
  })
  it.each(['CANCELLED', 'EXPIRED', 'COMPLETED'] as const)('does not match a %s donation', (status) => expect(rankEligibleNgos({ ...donation, status }, [ngo()], now)).toEqual([]))
  it('returns no result when no NGOs are suitable', () => expect(rankEligibleNgos(donation, [], now)).toEqual([]))
  it('deduplicates the same donation and NGO candidate', () => expect(rankEligibleNgos(donation, [ngo(), ngo()], now)).toHaveLength(1))
  it('returns stable rankings when matching is regenerated', () => expect(rankEligibleNgos(donation, [ngo()], now)).toEqual(rankEligibleNgos(donation, [ngo()], now)))
  it('permits generation only for POSTED or MATCHED records', () => { expect(canGenerateMatches('POSTED')).toBe(true); expect(canGenerateMatches('MATCHED')).toBe(true); expect(canGenerateMatches('ACCEPTED')).toBe(false) })
})
