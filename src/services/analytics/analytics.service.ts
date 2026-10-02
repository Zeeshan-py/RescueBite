import { getSupabaseClient } from '../../lib/supabase'
import type { UserRole } from '../../types/domain'
import type { AnalyticsRange, ImpactReport } from './analytics.types'
export async function getImpact(role: UserRole, range: AnalyticsRange): Promise<ImpactReport> {
  const { data, error } = await getSupabaseClient().rpc(role === 'ADMIN' ? 'get_platform_impact' : 'get_my_impact', range).abortSignal(AbortSignal.timeout(15000))
  if (error) throw new Error(error.code === '42501' ? 'You do not have permission to view these analytics.' : 'Analytics could not load. Check your connection and try again.')
  if (!data || data.role !== role) throw new Error('You do not have permission to view these analytics.')
  return data as ImpactReport
}
