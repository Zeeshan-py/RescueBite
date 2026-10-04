import { useCallback, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/useAuth'
import { DashboardView } from '../../components/dashboard/DashboardView'
import { getImpact } from '../../services/analytics/analytics.service'
import type { AnalyticsRange, RangePreset } from '../../services/analytics/analytics.types'
import { analyticsRange, percentage, workflowRates } from '../../services/analytics/analytics.utils'
import { useDashboardQuery } from '../../services/dashboard/useDashboardQuery'
import { donationStatuses } from '../../services/dashboard/dashboard.utils'
import type { DonationStatus } from '../../types/domain'
import { StatusBadge } from '../../components/common/StatusBadge'

const inputClass = 'mt-1 block w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2.5 text-sm'
export default function AnalyticsPage() {
  const { role } = useAuth()
  const [preset, setPreset] = useState<RangePreset>('30')
  const [from, setFrom] = useState(''), [to, setTo] = useState('')
  const [range, setRange] = useState<AnalyticsRange>(() => analyticsRange('30'))
  const [filterError, setFilterError] = useState<string | null>(null)
  const load = useCallback(() => getImpact(role!, range), [role, range])
  const query = useDashboardQuery(load), report = query.data
  function apply(event: FormEvent) {
    event.preventDefault()
    try { setRange(analyticsRange(preset, from, to)); setFilterError(null) }
    catch (reason) { setFilterError(reason instanceof Error ? reason.message : 'Invalid date range.') }
  }
  const volunteer = role === 'VOLUNTEER'
  const cards = report ? volunteer ? [
    ['Pickups claimed', report.tasks.claimed], ['Active pickups', report.tasks.active], ['Pickups collected', report.tasks.collected], ['Deliveries completed', report.tasks.delivered],
  ] : [
    ['Confirmed redistributed portions · during period', report.impact.portions], ['Donations completed · during period', report.impact.completed],
    ['Donations created · cohort', report.donations.total], ['Active donations · cohort', report.donations.active],
    ['Portions donated · cohort', report.donations.portions_donated], ['Portions redistributed · cohort', report.donations.portions_redistributed],
    ...(role === 'NGO' ? [['Accepted donations · cohort', report.donations.accepted], ['Pending matches · cohort', report.pending_matches]] : []),
    ...(role === 'ADMIN' ? Object.entries(report.participation).map(([key,value]) => [({donors:'Donor profiles registered · period',ngos:'NGO profiles created · period',volunteers:'Volunteer profiles registered · period',participating_donors:'Participating donors · creation cohort',receiving_ngos:'NGOs receiving confirmed donations · period',delivering_volunteers:'Volunteers delivering · period'} as Record<string,string>)[key] ?? key,value]) : []),
  ] : []
  const trendKey = volunteer ? 'delivered' : 'portions'
  const max = Math.max(1,...(report?.trends.map(t => t[trendKey]) ?? []))
  return <>
    <form aria-label="Report date filters" onSubmit={apply} className="mb-7 rounded-xl border border-line bg-white p-5"><p className="mb-4 text-sm font-semibold">Choose your reporting period</p><div className="grid min-w-0 gap-4 sm:grid-cols-3">
      <label className="min-w-0 text-xs font-semibold text-muted">Reporting period<select className={inputClass} value={preset} onChange={event=>setPreset(event.target.value as RangePreset)}><option value="7">Last 7 UTC days</option><option value="30">Last 30 UTC days</option><option value="90">Last 90 UTC days</option><option value="all">All time</option><option value="custom">Custom dates</option></select></label>
      {preset === 'custom' && <><label className="min-w-0 text-xs font-semibold text-muted">From date (UTC)<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className={inputClass}/></label><label className="min-w-0 text-xs font-semibold text-muted">To date (UTC)<input type="date" value={to} onChange={e=>setTo(e.target.value)} className={inputClass}/></label></>}
    </div><button className="mt-4 rounded-lg bg-pine px-5 py-2.5 text-sm font-semibold text-white">Apply period</button>{filterError && <p role="alert" className="mt-3 text-sm text-red-800">{filterError}</p>}</form>
    <DashboardView title={role === 'ADMIN' ? 'Analytics & impact' : 'My rescue analytics'} description="Real records, confirmed results. Dates and trend buckets use UTC; today may be incomplete." {...query}>
      {report && <><p className="mt-6 text-sm text-muted">{report.from ? `${report.from} through ${report.to} (inclusive)` : 'All time'} · {role === 'ADMIN' ? 'Platform-wide' : 'Your records only'}</p>
        <p className="mt-2 text-sm leading-6 text-muted">{volunteer ? 'Task counts use tasks created in the period. Delivered tasks mean completed deliveries; NGO confirmation is a separate step.' : 'Cohort counts use donations created in the period and their current state. Period impact uses the actual completion date, including donations posted earlier. Only COMPLETED donations count as redistributed; quantities cannot be combined because units are not stored.'} {role === 'NGO' && 'Donation totals include accepted matches for your organization; pending matches are separate.'}</p>
        <dl className="mt-7 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label,value])=><div key={label} className="min-w-0 rounded-xl border border-line bg-white p-5"><dt className="text-xs font-semibold text-muted capitalize">{label}</dt><dd className="mt-3 break-words font-display text-4xl text-pine">{Number(value).toLocaleString()}</dd></div>)}</dl>
        <section className="mt-8"><h2 className="text-lg font-semibold">Workflow performance</h2><p className="mt-2 text-sm text-muted">Current outcomes of the creation cohort. N/A means the denominator is zero; these are not event funnel timings.</p><dl className="mt-4 grid gap-4 sm:grid-cols-2">{workflowRates(report).filter(rate=>!volunteer || rate.label.startsWith('Pickup') || rate.label.startsWith('Delivery')).map(rate=><div key={rate.label} className="rounded-xl border border-line bg-white p-5"><dt className="font-semibold">{rate.label}</dt><dd className="mt-2 text-2xl text-forest">{percentage(rate.n,rate.d)} <span className="text-sm text-muted">({rate.n} / {rate.d})</span></dd><p className="mt-2 text-xs leading-5 text-muted">{rate.definition}</p></div>)}</dl></section>
        <section className="mt-8"><h2 className="text-lg font-semibold">{volunteer ? 'Delivery trend' : 'Redistribution trend'} · {report.bucket} buckets</h2><p className="mt-2 text-sm text-muted">Actual completion/delivery dates. Each bar includes its exact value.</p>{!report.trends.some(t=>t[trendKey]>0) && <p className="mt-4 rounded-xl border border-dashed border-line p-5 text-sm text-muted">No confirmed {volunteer ? 'deliveries' : 'redistribution'} in this period.</p>}<div className="mt-4 grid min-w-0 gap-3">{report.trends.filter(t=>t[trendKey]>0).map(t=><div key={t.date} className="min-w-0 rounded-lg border border-line bg-white p-3"><div className="flex flex-wrap justify-between gap-2 text-xs"><span>{t.date}</span><span>{t[trendKey].toLocaleString()} {volunteer ? 'deliveries' : 'portions'}</span></div><div className="mt-2 h-3 rounded bg-line" aria-hidden="true"><div className="h-3 rounded bg-forest" style={{width:`${100*t[trendKey]/max}%`}}/></div></div>)}</div></section>
        <section className="mt-8"><h2 className="text-lg font-semibold">Trend records</h2><p className="mt-2 text-xs text-muted">{role === 'ADMIN' && 'New NGOs count organization profiles, not registrations. '}Zero buckets are retained; monthly/yearly labels identify bucket starts.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{report.trends.map(t=><dl key={t.date} className="min-w-0 rounded-xl border border-line bg-white p-4"><dt className="font-semibold">{t.date}</dt><dd className="mt-2 text-sm leading-6 text-muted">{volunteer ? `${t.collected} collections · ${t.delivered} deliveries` : `${t.posted} created · ${t.completed} completed · ${t.portions} redistributed portions`}{role==='ADMIN' && <span className="block">{t.donors} new donors · {t.ngos} new NGOs</span>}</dd></dl>)}</div></section>
        {!volunteer && <section className="mt-8"><h2 className="text-lg font-semibold">Donation status · creation cohort</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2">{donationStatuses.map(status=><div key={status} className="flex flex-wrap justify-between gap-2 rounded-lg border border-line bg-white p-4 text-sm"><dt><StatusBadge status={status as DonationStatus} /></dt><dd>{report.statuses[status] ?? 0}</dd></div>)}</dl></section>}
      </>}
    </DashboardView>
  </>
}
