import { describe, expect, it } from 'vitest'
import type { Donation, PickupTask } from '../../types/domain'
import type { PickupTaskWithDonation } from './pickup.types'
import { groupPickupTasks, isPickupClaimable } from './pickup.utils'

const now = new Date('2026-09-28T10:00:00Z')
const donation: Donation = { id: 'd1', donor_id: 'donor', food_type: 'Meals', quantity: 10, meal_portions: 20, location: 'Lahore', latitude: null, longitude: null, available_from: '2026-09-28T09:00:00Z', collection_deadline: '2026-09-28T14:00:00Z', safety_information: null, description: null, status: 'ACCEPTED', completed_at: null, recipient_scope: 'NGO_ONLY', public_area: '', created_at: now.toISOString(), updated_at: now.toISOString() }
const task: PickupTask = { id: 'p1', donation_id: 'd1', volunteer_id: null, pickup_location: 'Lahore', delivery_location: 'Community Kitchen', pickup_time: null, collected_at: null, delivered_at: null, status: 'AVAILABLE', notes: null, created_at: now.toISOString() }
const item = (overrides: Partial<PickupTaskWithDonation> = {}): PickupTaskWithDonation => ({ ...task, donation, ...overrides })

describe('pickup workflow helpers', () => {
  it('allows only AVAILABLE tasks for accepted, unexpired donations', () => {
    expect(isPickupClaimable(item(), now)).toBe(true)
    expect(isPickupClaimable(item({ status: 'ASSIGNED', volunteer_id: 'v1' }), now)).toBe(false)
    expect(isPickupClaimable(item({ donation: { ...donation, status: 'CANCELLED' } }), now)).toBe(false)
  })
  it('rejects a pickup after its deadline', () => expect(isPickupClaimable(item({ donation: { ...donation, collection_deadline: '2026-09-28T09:00:00Z' } }), now)).toBe(false))
  it('groups available, assigned, collected, delivered, and unavailable tasks', () => {
    const groups = groupPickupTasks([item(), item({ id: 'p2', status: 'ASSIGNED', volunteer_id: 'v1' }), item({ id: 'p3', status: 'COLLECTED', volunteer_id: 'v1' }), item({ id: 'p4', donation: { ...donation, status: 'CANCELLED' } }), item({ id: 'p5', status: 'DELIVERED', volunteer_id: 'v1', delivered_at: now.toISOString() })], 'v1', now)
    expect([groups.available.length, groups.assigned.length, groups.collected.length, groups.delivered.length, groups.unavailable.length]).toEqual([1, 1, 1, 1, 1])
  })
})
