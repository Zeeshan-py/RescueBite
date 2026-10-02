import type { AnalyticsRange, ImpactReport, RangePreset } from './analytics.types'
export function analyticsRange(preset: RangePreset, from = '', to = '', now = new Date()): AnalyticsRange {
  if (preset === 'all') return { from_date: null, to_date: null }
  const today = now.toISOString().slice(0, 10)
  if (preset !== 'custom') {
    const first = new Date(`${today}T00:00:00Z`)
    first.setUTCDate(first.getUTCDate() - Number(preset) + 1)
    return { from_date: first.toISOString().slice(0, 10), to_date: today }
  }
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s
  if (!valid(from) || !valid(to) || from > to || to > today || (Date.parse(to) - Date.parse(from)) / 86400000 > 3660) throw new Error('Choose valid UTC dates in order, ending no later than today (up to 3660 days).')
  return { from_date: from, to_date: to }
}
export function percentage(numerator: number, denominator: number): string {
  if (!denominator) return 'N/A'
  return `${(100 * numerator / denominator).toFixed(1)}%`
}
export function workflowRates(report: ImpactReport) {
  const d = report.donations, t = report.tasks
  return [
    { label: 'Match rate', n: d.matched, d: d.total, definition: 'Donations with a stored candidate match / all cohort donations' },
    { label: 'Acceptance rate', n: d.accepted, d: d.matched, definition: 'Donations with an ACCEPTED match / donations with any stored match' },
    { label: 'Pickup completion rate', n: t.collected, d: t.total, definition: 'Tasks with collected_at / all tasks created in the range' },
    { label: 'Delivery completion rate', n: t.delivered, d: t.total, definition: 'DELIVERED tasks / all tasks created in the range' },
    { label: 'Donation completion rate', n: d.completed, d: d.total, definition: 'COMPLETED donations / all cohort donations, including active and unsuccessful records' },
    { label: 'Cancellation rate', n: d.cancelled, d: d.total, definition: 'CANCELLED donations / all cohort donations' },
    { label: 'Expiry rate', n: d.expired, d: d.total, definition: 'EXPIRED donations / all cohort donations' },
  ]
}
