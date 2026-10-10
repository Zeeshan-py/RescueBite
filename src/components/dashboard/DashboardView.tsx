import type { ReactNode } from 'react'
import { LoadingState } from '../common/LoadingState'
import { EmptyState } from '../common/EmptyState'
import type { DashboardSummary } from '../../services/dashboard/dashboard.types'
import { summaryCards } from '../../services/dashboard/dashboard.utils'
import { Icon, type IconName } from '../common/Icon'
import { MetricCard } from './MetricCard'

export function DashboardView({ title, description, loading, error, refresh, children, eyebrow = 'YOUR RESCUE WORKSPACE', actions }: {
  title: string; description: string; loading: boolean; error: string | null; refresh: () => void; children: ReactNode
  eyebrow?: string; actions?: ReactNode
}) {
  return <div className="dashboard-page"><div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div><div className="page-actions">{actions}<button onClick={refresh} disabled={loading} className="button-secondary"><Icon name="refresh" width="16" />Refresh</button></div></div>
    {loading ? <LoadingState label="Loading dashboard…" /> : error ? <div role="alert" className="mt-7 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><p>{error}</p><button onClick={refresh} className="mt-3 font-semibold underline">Try again</button></div> : children}
  </div>
}
export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const cards = summaryCards(summary).filter(({ value }) => value > 0)
  if (!cards.length) return null
  const priority = summary.role === 'ADMIN' ? ['total_donations', 'active', 'completed', 'active_pickups']
    : summary.role === 'DONOR' ? ['total_donations', 'active', 'completed', 'awaiting_pickup']
      : summary.role === 'NGO' ? ['suggested', 'accepted', 'completed', 'awaiting_confirmation'] : ['available', 'assigned', 'delivered', 'completed']
  const ordered = [...cards].sort((a, b) => (priority.indexOf(a.key) < 0 ? 99 : priority.indexOf(a.key)) - (priority.indexOf(b.key) < 0 ? 99 : priority.indexOf(b.key)))
  const icons: IconName[] = ['box', 'activity', 'check', 'truck']
  return <><dl className="metrics-grid dashboard-metrics">{ordered.slice(0, 4).map(({ key, label, value }, i) => <MetricCard key={key} label={label} value={value} icon={icons[i]} accent={i === 2} />)}</dl>{ordered.length > 4 && <dl className="summary-strip">{ordered.slice(4).map(({ key, label, value }) => <div key={key}><dd>{value.toLocaleString()}</dd><dt>{label}</dt></div>)}</dl>}</>
}
export function DashboardSection({ title, children, empty }: { title: string; children?: ReactNode; empty?: string }) {
  return <section className="dashboard-section"><h2>{title}</h2>{empty ? <EmptyState title={empty} /> : <div className="dashboard-section-content">{children}</div>}</section>
}
