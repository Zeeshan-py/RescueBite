import type { UserRole } from '../../types/domain'
export type RangePreset = '7' | '30' | '90' | 'all' | 'custom'
export interface AnalyticsRange { from_date: string | null; to_date: string | null }
export interface ImpactTrend { date: string; posted: number; completed: number; portions: number; donors: number; ngos: number; collected: number; delivered: number }
export interface ImpactReport {
  role: UserRole; from: string | null; to: string | null; bucket: 'day' | 'month' | 'year';
  donations: { total: number; active: number; completed: number; cancelled: number; expired: number; portions_donated: number; portions_redistributed: number; matched: number; accepted: number };
  statuses: Record<string, number>; impact: { completed: number; portions: number };
  tasks: { total: number; claimed: number; active: number; collected: number; delivered: number };
  requests: { total: number; pending: number; accepted: number; completed: number; closed: number };
  pending_matches: number; participation: Record<string, number>; trends: ImpactTrend[];
}
