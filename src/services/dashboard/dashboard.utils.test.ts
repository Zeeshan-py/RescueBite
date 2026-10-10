import { describe, expect, it } from 'vitest'
import { adminQuery, emptyAdminFilters, formatAdminValue, summaryCards } from './dashboard.utils'
import type { UserRole } from '../../types/domain'

describe('dashboard summaries', () => {
  it.each(['DONOR', 'NGO', 'RECIPIENT', 'ADMIN'] as UserRole[])('renders real %s counts, including empty records', (role) => {
    const cards = summaryCards({ role, counts: {}, statuses: {} })
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.every((card) => card.value === 0)).toBe(true)
    const actual = summaryCards({ role, counts: { [cards[0]!.key]: 47 }, statuses: {} })
    expect(actual[0]!.value).toBe(47)
  })
})
describe('admin database filters', () => {
  it('passes user search and role filters to the server', () => {
    expect(adminQuery('users', { ...emptyAdminFilters, search: '  NGO name  ', role: 'NGO' }, 2)).toMatchObject({ view_name: 'users', search_text: 'NGO name', role_filter: 'NGO', page_number: 2 })
  })
  it('passes donation filters and dates to the server', () => {
    expect(adminQuery('donations', { ...emptyAdminFilters, status: 'DELIVERED', food: 'Bakery', from: '2026-10-01', to: '2026-10-02' }, 1)).toMatchObject({ status_filter: 'DELIVERED', food_filter: 'Bakery', from_date: '2026-10-01', to_date: '2026-10-02' })
  })
  it('passes activity and related entity filters', () => {
    expect(adminQuery('activity', { ...emptyAdminFilters, action: 'FOOD_DELIVERED', entity: 'PICKUP_TASK' }, 1)).toMatchObject({ action_filter: 'FOOD_DELIVERED', entity_filter: 'PICKUP_TASK', from_date: null, to_date: null })
  })
  it('rejects reversed dates and invalid pages', () => {
    expect(() => adminQuery('donations', { ...emptyAdminFilters, from: '2026-10-02', to: '2026-10-01' }, 1)).toThrow('Start date')
    for (const page of [0, -1, 1.2, 100001]) expect(() => adminQuery('users', emptyAdminFilters, page)).toThrow('Invalid page')
  })
  it('bounds search length', () => expect(adminQuery('users', { ...emptyAdminFilters, search: 'x'.repeat(300) }, 1).search_text).toHaveLength(200))
})
describe('admin record presentation', () => {
  it('preserves zero counts and formats nullable fields', () => {
    expect(formatAdminValue({ active_count: 0 }, 'active_count')).toBe('0')
    expect(formatAdminValue({ actor_name: null }, 'actor_name')).toBe('Not recorded')
  })
  it('formats food lists and coordinate availability', () => {
    expect(formatAdminValue({ accepted_food_types: ['Cooked Food', 'Bakery'] }, 'accepted_food_types')).toBe('Cooked Food, Bakery')
    expect(formatAdminValue({ has_coordinates: false }, 'has_coordinates')).toBe('Not selected')
  })
})
