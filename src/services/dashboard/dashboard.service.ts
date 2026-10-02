import { getSupabaseClient } from '../../lib/supabase'
import type { UserRole } from '../../types/domain'
import { getPickupDestination } from '../delivery/delivery.service'
import type { NgoDonationMatch } from '../ngo/ngo-workflow.types'
import type { PickupTaskWithDonation } from '../pickups/pickup.types'
import { adminQuery, emptyAdminFilters } from './dashboard.utils'
import type { AdminDashboard, AdminRecords, AdminView, DashboardSummary, DonorDashboard, NgoDashboard, VolunteerDashboard } from './dashboard.types'

function fail(error: { message: string; code?: string }): never {
  if (error.code === '42501') throw new Error('You do not have permission to view this dashboard.')
  throw new Error('The dashboard could not load. Check your connection and try again.')
}
export async function getDashboardSummary(expectedRole: UserRole): Promise<DashboardSummary> {
  const { data, error } = await getSupabaseClient().rpc(expectedRole === 'ADMIN' ? 'get_admin_dashboard' : 'get_dashboard_summary').abortSignal(AbortSignal.timeout(15000))
  if (error) fail(error)
  if (!data || data.role !== expectedRole) throw new Error('You do not have permission to view this dashboard.')
  return data as DashboardSummary
}
export async function getDonorDashboard(userId: string): Promise<DonorDashboard> {
  const [summary, result] = await Promise.all([getDashboardSummary('DONOR'), getSupabaseClient().from('donations').select('*').eq('donor_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(5).abortSignal(AbortSignal.timeout(15000))])
  if (result.error) fail(result.error)
  return { summary, recent: result.data }
}
export async function getNgoDashboard(ngoId: string | null): Promise<NgoDashboard> {
  const summary = await getDashboardSummary('NGO')
  if (!ngoId) return { summary, pending: [], accepted: [], deliveries: [] }
  const base = () => getSupabaseClient().from('matches').select('*, donation:donations!inner(*)').eq('ngo_id', ngoId)
  const [pending, accepted, deliveries] = await Promise.all([
    base().in('status', ['SUGGESTED', 'VIEWED']).eq('donation.status', 'MATCHED').gt('donation.collection_deadline', new Date().toISOString()).order('donation(collection_deadline)', { ascending: true }).limit(5).abortSignal(AbortSignal.timeout(15000)),
    base().eq('status', 'ACCEPTED').order('created_at', { ascending: false }).limit(5).abortSignal(AbortSignal.timeout(15000)),
    base().eq('status', 'ACCEPTED').in('donation.status', ['DELIVERED', 'COMPLETED']).order('donation(updated_at)', { ascending: false }).limit(5).abortSignal(AbortSignal.timeout(15000)),
  ])
  for (const result of [pending, accepted, deliveries]) if (result.error) fail(result.error)
  return { summary, pending: pending.data as unknown as NgoDonationMatch[], accepted: accepted.data as unknown as NgoDonationMatch[], deliveries: deliveries.data as unknown as NgoDonationMatch[] }
}
export async function getVolunteerDashboard(userId: string): Promise<VolunteerDashboard> {
  const base = () => getSupabaseClient().from('pickup_tasks').select('*, donation:donations!inner(*)')
  const [summary, available, assigned, history] = await Promise.all([
    getDashboardSummary('VOLUNTEER'),
    base().eq('status', 'AVAILABLE').eq('donation.status', 'ACCEPTED').gt('donation.collection_deadline', new Date().toISOString()).order('donation(collection_deadline)', { ascending: true }).limit(5).abortSignal(AbortSignal.timeout(15000)),
    base().eq('volunteer_id', userId).in('status', ['ASSIGNED', 'COLLECTED']).order('created_at', { ascending: false }).limit(5).abortSignal(AbortSignal.timeout(15000)),
    base().eq('volunteer_id', userId).in('status', ['DELIVERED', 'CANCELLED']).order('created_at', { ascending: false }).limit(5).abortSignal(AbortSignal.timeout(15000)),
  ])
  for (const result of [available, assigned, history]) if (result.error) fail(result.error)
  const tasks = assigned.data as unknown as PickupTaskWithDonation[]
  const destination = tasks[0] ? await getPickupDestination(tasks[0].donation_id) : null
  return { summary, available: available.data as unknown as PickupTaskWithDonation[], assigned: tasks, history: history.data as unknown as PickupTaskWithDonation[], destination }
}
export async function getAdminRecords(view: AdminView, filters = emptyAdminFilters, page = 1): Promise<AdminRecords> {
  const { data, error } = await getSupabaseClient().rpc('get_admin_records', adminQuery(view, filters, page)).abortSignal(AbortSignal.timeout(15000))
  if (error) fail(error)
  return data as AdminRecords
}
export async function getAdminDashboard(): Promise<AdminDashboard> {
  const [summary, donations, activity] = await Promise.all([getDashboardSummary('ADMIN'), getAdminRecords('donations'), getAdminRecords('activity')])
  return { summary, donations: { ...donations, rows: donations.rows.slice(0, 5) }, activity: { ...activity, rows: activity.rows.slice(0, 5) } }
}
