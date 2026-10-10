import { describe, expect, it } from 'vitest'
import type { Donation, PickupTask } from '../../types/domain'
import { canConfirmReceipt, canMarkDelivered } from './delivery.utils'

const donation: Donation = { id: 'd1', donor_id: 'donor', food_type: 'Meals', quantity: 5, meal_portions: 10, location: 'Lahore', latitude: null, longitude: null, available_from: '2026-09-28T08:00:00Z', collection_deadline: '2026-09-28T10:00:00Z', safety_information: null, description: null, status: 'COLLECTED', completed_at: null, recipient_scope: 'NGO_ONLY', public_area: '', created_at: '2026-09-28T07:00:00Z', updated_at: '2026-09-28T09:00:00Z' }
const task: PickupTask = { id: 'p1', donation_id: 'd1', volunteer_id: 'v1', pickup_location: 'A', delivery_location: 'B', pickup_time: '2026-09-28T08:30:00Z', collected_at: '2026-09-28T09:00:00Z', delivered_at: null, status: 'COLLECTED', notes: null, created_at: '2026-09-28T08:00:00Z' }

describe('delivery workflow helpers', () => {
  it('offers delivery only to the assigned volunteer for a collected task', () => {
    expect(canMarkDelivered(task, 'v1')).toBe(true)
    expect(canMarkDelivered(task, 'v2')).toBe(false)
    expect(canMarkDelivered({ ...task, status: 'DELIVERED', delivered_at: '2026-09-28T09:30:00Z' }, 'v1')).toBe(false)
  })

  it('offers receipt confirmation only when pickup and donation are delivered', () => {
    const deliveredTask = { ...task, status: 'DELIVERED', delivered_at: '2026-09-28T09:30:00Z' } as PickupTask
    expect(canConfirmReceipt({ ...donation, status: 'DELIVERED' }, deliveredTask)).toBe(true)
    expect(canConfirmReceipt(donation, deliveredTask)).toBe(false)
    expect(canConfirmReceipt({ ...donation, status: 'DELIVERED' }, task)).toBe(false)
  })
})
