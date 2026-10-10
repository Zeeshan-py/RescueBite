import type { UserRole } from '../../types/domain'
import type { AdminFilters, AdminRow, AdminView, DashboardSummary } from './dashboard.types'

export const emptyAdminFilters: AdminFilters = { search: '', status: '', role: '', food: '', action: '', entity: '', from: '', to: '' }
export const donationStatuses = ['POSTED', 'MATCHED', 'ACCEPTED', 'PICKUP_ASSIGNED', 'COLLECTED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'EXCEPTION']
export const dashboardCards: Record<UserRole, Array<[string, string]>> = {
  DONOR: [['total_donations', 'Total donations'], ['active', 'Active donations'], ['completed', 'Completed'], ['closed', 'Cancelled / expired'], ['awaiting_acceptance', 'Awaiting NGO acceptance'], ['awaiting_pickup', 'Awaiting pickup'], ['delivered', 'Delivered / completed'], ['exceptions', 'Exceptions']],
  NGO: [['suggested', 'Pending decisions'], ['accepted', 'Accepted donations'], ['awaiting_pickup', 'Awaiting pickup'], ['collected', 'Collected / awaiting delivery'], ['awaiting_confirmation', 'Confirm receipt'], ['completed', 'Completed']],
  RECIPIENT: [['available','Available Meals'], ['total_requests','My Requests'], ['pending','Pending'], ['accepted','Accepted'], ['completed','Collected'], ['closed','Closed']],
  ADMIN: [['total_users', 'Total users'], ['donors', 'Donors'], ['ngo_users', 'NGO users'], ['organizations', 'NGO profiles'], ['recipients', 'Recipients'], ['total_donations', 'Total donations'], ['active', 'Active donations'], ['completed', 'Completed donations'], ['closed', 'Cancelled / expired'], ['active_pickups', 'Awaiting collection'], ['exceptions', 'Exceptions']],
}
export function summaryCards(summary: DashboardSummary) {
  return dashboardCards[summary.role].map(([key, label]) => ({ key, label, value: summary.counts[key] ?? 0 }))
}
export function adminQuery(view: AdminView, filters: AdminFilters, page: number) {
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw new Error('Invalid page.')
  if (filters.from && filters.to && filters.from > filters.to) throw new Error('Start date must be before end date.')
  return { view_name: view, search_text: filters.search.trim().slice(0, 200), status_filter: filters.status,
    role_filter: filters.role, food_filter: filters.food, action_filter: filters.action,
    entity_filter: filters.entity, from_date: filters.from || null, to_date: filters.to || null, page_number: page }
}
export function formatDashboardDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
export function formatAdminValue(row: AdminRow, field: string): string {
  const value = row[field]
  if (value === null || value === undefined || value === '') return 'Not recorded'
  if (field.endsWith('_at') || field === 'collection_deadline') return formatDashboardDate(String(value))
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'None specified'
  if (typeof value === 'boolean') return value ? 'Available' : 'Not selected'
  return String(value).replaceAll('_', ' ')
}
