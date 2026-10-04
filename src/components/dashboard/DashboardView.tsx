import type { ReactNode } from 'react'
import { LoadingState } from '../common/LoadingState'
import { EmptyState } from '../common/EmptyState'
import type { DashboardSummary } from '../../services/dashboard/dashboard.types'
import { summaryCards } from '../../services/dashboard/dashboard.utils'

export function DashboardView({ title, description, loading, error, refresh, children }: {
  title: string; description: string; loading: boolean; error: string | null; refresh: () => void; children: ReactNode
}) {
  return <div><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-display text-4xl sm:text-5xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{description}</p></div><button onClick={refresh} disabled={loading} className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-forest disabled:opacity-50">Refresh</button></div>
    {loading ? <LoadingState label="Loading dashboard…" /> : error ? <div role="alert" className="mt-7 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><p>{error}</p><button onClick={refresh} className="mt-3 font-semibold underline">Try again</button></div> : children}
  </div>
}
export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  return <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{summaryCards(summary).map(({ key, label, value }) => <div key={key} className="rounded-xl border border-line bg-white p-5"><dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt><dd className="mt-3 font-display text-4xl text-pine">{value}</dd></div>)}</dl>
}
export function DashboardSection({ title, children, empty }: { title: string; children?: ReactNode; empty?: string }) {
  return <section className="mt-8"><h2 className="mb-4 text-lg font-semibold">{title}</h2>{empty ? <EmptyState title={empty} description="Use the workspace actions above to review available opportunities or start your next rescue." /> : <div className="grid gap-4">{children}</div>}</section>
}
