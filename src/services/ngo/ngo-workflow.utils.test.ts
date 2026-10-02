import { describe, expect, it } from 'vitest'
import type { Donation, Match } from '../../types/domain'
import type { NgoDonationMatch } from './ngo-workflow.types'
import { groupNgoMatches, isActionableMatch } from './ngo-workflow.utils'

const now = new Date('2026-09-28T10:00:00Z')
const donation: Donation = { id: 'd1', donor_id: 'donor', food_type: 'Cooked Food', quantity: 10, meal_portions: 20, location: 'Lahore', latitude: null, longitude: null, available_from: '2026-09-28T09:00:00Z', collection_deadline: '2026-09-28T14:00:00Z', safety_information: null, description: null, status: 'MATCHED', completed_at: null, created_at: now.toISOString(), updated_at: now.toISOString() }
const match: Match = { id: 'm1', donation_id: 'd1', ngo_id: 'n1', matching_score: 90, distance_score: 100, distance_km: null, urgency_score: 80, compatibility_score: 100, capacity_score: 80, availability_score: 70, status: 'SUGGESTED', created_at: now.toISOString() }
const item = (matchStatus: Match['status'], donationStatus: Donation['status'] = 'MATCHED'): NgoDonationMatch => ({ ...match, status: matchStatus, donation: { ...donation, status: donationStatus } })

describe('NGO workflow grouping', () => {
  it('treats only current suggestions on MATCHED donations as actionable', () => {
    expect(isActionableMatch(item('SUGGESTED'), now)).toBe(true)
    expect(isActionableMatch(item('REJECTED'), now)).toBe(false)
    expect(isActionableMatch(item('SUGGESTED', 'ACCEPTED'), now)).toBe(false)
  })
  it('excludes suggestions after their collection deadline', () => {
    expect(isActionableMatch({ ...item('SUGGESTED'), donation: { ...donation, collection_deadline: '2026-09-28T09:00:00Z' } }, now)).toBe(false)
  })
  it('separates actionable, accepted, and historical involvement', () => {
    const groups = groupNgoMatches([item('SUGGESTED'), item('ACCEPTED', 'ACCEPTED'), item('REJECTED')], now)
    expect(groups.actionable).toHaveLength(1)
    expect(groups.accepted).toHaveLength(1)
    expect(groups.history).toHaveLength(1)
  })
})
