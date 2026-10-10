import { getSupabaseClient } from '../../lib/supabase'
import type { UserRole } from '../../types/domain'
import type { NgoDonationMatch } from '../ngo/ngo-workflow.types'
import { adminQuery, emptyAdminFilters } from './dashboard.utils'
import type { AdminDashboard, AdminRecords, AdminView, DashboardSummary, DonorDashboard, NgoDashboard } from './dashboard.types'

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
export async function getAdminRecords(view: AdminView, filters = emptyAdminFilters, page = 1): Promise<AdminRecords> {
  const { data, error } = await getSupabaseClient().rpc('get_admin_records', adminQuery(view, filters, page)).abortSignal(AbortSignal.timeout(15000))
  if (error) fail(error)
  return data as AdminRecords
}
export async function moderateAdminRecord(targetType: 'USER' | 'NGO' | 'DONATION', targetId: string, decision: string, reason: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_moderate', { target_type: targetType, target_id: targetId, decision, reason: reason.trim() }).abortSignal(AbortSignal.timeout(15000))
  if (error) throw new Error(error.message || 'Moderation failed. Try again.')
}
export async function getAdminDashboard(): Promise<AdminDashboard> {
  const [summary, donations, activity] = await Promise.all([getDashboardSummary('ADMIN'), getAdminRecords('donations'), getAdminRecords('activity')])
  return { summary, donations: { ...donations, rows: donations.rows.slice(0, 5) }, activity: { ...activity, rows: activity.rows.slice(0, 5) } }
}
