import { useCallback, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/useAuth'
import { DashboardView } from '../../components/dashboard/DashboardView'
import { MetricCard } from '../../components/dashboard/MetricCard'
import { ActivityChart, OutcomeChart, StatusBars } from '../../components/analytics/AnalyticsCharts'
import { Icon, type IconName } from '../../components/common/Icon'
import { getImpact } from '../../services/analytics/analytics.service'
import type { AnalyticsRange, ImpactReport, RangePreset } from '../../services/analytics/analytics.types'
import { analyticsRange, percentage, workflowRates } from '../../services/analytics/analytics.utils'
import { useDashboardQuery } from '../../services/dashboard/useDashboardQuery'

function exportReport(report: ImpactReport) {
  const columns = ['date', 'posted', 'completed', 'portions', 'collected', 'delivered', 'donors', 'ngos'] as const
  const csv = [columns.join(','), ...report.trends.map(row => columns.map(key => row[key]).join(','))].join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url; link.download = `rescuebite-impact-${report.from ?? 'all-time'}-${report.to ?? new Date().toISOString().slice(0, 10)}.csv`
  link.click(); URL.revokeObjectURL(url)
}
export default function AnalyticsPage() {
  const { role } = useAuth()
  const [preset, setPreset] = useState<RangePreset>('all')
  const [from, setFrom] = useState(''), [to, setTo] = useState('')
  const [range, setRange] = useState<AnalyticsRange>(() => analyticsRange('all'))
  const [filterError, setFilterError] = useState<string | null>(null)
  const load = useCallback(() => getImpact(role!, range), [role, range])
  const query = useDashboardQuery(load), report = query.data
  function apply(event: FormEvent) {
    event.preventDefault()
    try { setRange(analyticsRange(preset, from, to)); setFilterError(null) }
    catch (reason) { setFilterError(reason instanceof Error ? reason.message : 'Invalid date range.') }
  }
  const volunteer = role === 'VOLUNTEER'
  const deliveriesInPeriod = report?.trends.reduce((total, row) => total + row.delivered, 0) ?? 0
  const metrics: Array<{ label: string; value: number; note: string; icon: IconName }> = !report ? [] : volunteer ? [
    { label: 'Pickups claimed', value: report.tasks.claimed, note: 'Claims on tasks created in this period', icon: 'box' },
    { label: 'Active pickups', value: report.tasks.active, note: 'Active tasks created in this period', icon: 'clock' },
    { label: 'Food collected', value: report.tasks.collected, note: 'Collected tasks created in this period', icon: 'check' },
    { label: 'Deliveries completed', value: report.tasks.delivered, note: 'Delivered tasks created in this period', icon: 'truck' },
  ] : [
    { label: 'Donations created', value: report.donations.total, note: 'Created in the selected period', icon: 'box' },
    { label: 'Active donations', value: report.donations.active, note: 'Rescues currently in progress', icon: 'activity' },
    { label: 'Confirmed rescues', value: report.impact.completed, note: 'Completed during the period', icon: 'check' },
    { label: 'Portions redistributed', value: report.impact.portions, note: 'Confirmed by the receiving NGO', icon: 'leaf' },
  ]
  const rates = report ? workflowRates(report).filter(rate => !volunteer || rate.label.startsWith('Pickup') || rate.label.startsWith('Delivery')) : []
  const participationLabels: Record<string, string> = { donors: 'Donor registrations', ngos: 'NGO profiles created', volunteers: 'Volunteer registrations', participating_donors: 'Participating donors', receiving_ngos: 'Receiving NGOs', delivering_volunteers: 'Delivering volunteers' }
  return <DashboardView eyebrow={role === 'ADMIN' ? 'PLATFORM INTELLIGENCE' : 'YOUR CONTRIBUTION'} title={role === 'ADMIN' ? 'Analytics & impact' : 'Your impact, in focus'}
    description={role === 'ADMIN' ? 'A clearer view of every rescue, every connection, and the impact they create.' : 'Follow your rescue activity and see the difference your contributions make.'}
    actions={<button type="button" className="button-secondary" disabled={!report || query.loading || Boolean(query.error)} onClick={() => report && exportReport(report)}><Icon name="download" width="17" />Export report</button>} {...query}>
    <form aria-label="Report date filters" onSubmit={apply} className="report-toolbar">
      <div className="report-scope"><span className="scope-icon"><Icon name="calendar" /></span><div><strong>{report?.from ? `${report.from} – ${report.to}` : 'All-time overview'}</strong><span>{role === 'ADMIN' ? 'Across your food rescue network' : 'Your records and confirmed impact'} · UTC</span></div></div>
      <div className="report-filter-controls"><label className="sr-only" htmlFor="report-period">Reporting period</label><select id="report-period" value={preset} onChange={event => setPreset(event.target.value as RangePreset)}><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="custom">Custom dates</option></select>
        {preset === 'custom' && <><label className="custom-date-label">From (UTC)<input type="date" value={from} onChange={event => setFrom(event.target.value)} required /></label><label className="custom-date-label">To (UTC)<input type="date" value={to} onChange={event => setTo(event.target.value)} required /></label></>}
        <button className="button-primary" type="submit">Apply period</button>
      </div>{filterError && <p role="alert" className="filter-error">{filterError}</p>}
    </form>
    {report && <>
      <dl className="metrics-grid">{metrics.map((metric, i) => <MetricCard key={metric.label} {...metric} accent={i === metrics.length - 1} />)}</dl>
      <div className="analytics-primary-grid">
        <ActivityChart trends={report.trends} bucket={report.bucket} volunteer={volunteer} />
        <section className="impact-spotlight"><div className="spotlight-top"><span className="eyebrow">{volunteer ? 'DELIVERING CHANGE' : 'FOOD WITH A FUTURE'}</span><span className="spotlight-icon"><Icon name="leaf" width="24" height="24" /></span></div>
          <h2>Small actions.<br />Meaningful impact.</h2><p>{volunteer ? 'Every completed delivery brings surplus food closer to the people who need it.' : 'Every confirmed portion is food shared with a community, with receipt recorded by an NGO.'}</p>
          <div className="spotlight-total"><strong>{(volunteer ? deliveriesInPeriod : report.impact.portions).toLocaleString()}</strong><span>{volunteer ? 'deliveries completed' : 'portions redistributed'}</span></div>
          <div className="spotlight-detail"><Icon name="check" width="17" /><span>{volunteer ? 'Delivery events recorded during this period' : `${report.impact.completed.toLocaleString()} rescues confirmed during this period`}</span></div>
          <div className="spotlight-art" aria-hidden="true"><span /><span /><span /></div>
        </section>
      </div>
      <div className="analytics-secondary-grid">
        {!volunteer && <OutcomeChart statuses={report.statuses} />}
        <section className="surface performance-panel"><div className="panel-heading"><div><p className="eyebrow">FROM SURPLUS TO SHARED</p><h2>Workflow performance</h2></div><Icon name="activity" /></div>
          <div className="performance-list">{rates.map(rate => <div key={rate.label} className={`performance-row${['Cancellation rate', 'Expiry rate'].includes(rate.label) ? ' risk-rate' : ''}`}><div><span>{rate.label.replace(' rate', '')}</span><strong>{percentage(rate.n, rate.d)}</strong></div><div className="bar-track" aria-hidden="true"><span style={{ width: `${rate.d ? Math.min(100, rate.n / rate.d * 100) : 0}%` }} /></div><p>{rate.n.toLocaleString()} of {rate.d.toLocaleString()} · {rate.definition}</p></div>)}</div>
          <p className="panel-footnote">Current outcomes for records created in the selected period. N/A means no eligible records.</p>
        </section>
      </div>
      {role === 'ADMIN' && <section className="surface network-panel"><div className="panel-heading"><div><p className="eyebrow">PEOPLE BEHIND THE IMPACT</p><h2>A connected rescue network</h2></div><Icon name="users" /></div><dl className="network-metrics">{Object.entries(report.participation).map(([key, value]) => <div key={key}><dd>{value.toLocaleString()}</dd><dt>{participationLabels[key] ?? key.replaceAll('_', ' ')}</dt></div>)}</dl></section>}
      <details className="surface report-details"><summary><div><span className="eyebrow">EXPLORE THE NUMBERS</span><h2>Detailed report</h2><p>Period-by-period records and donation status breakdown</p></div><Icon name="plus" /></summary>
        <div className="report-details-content">{!volunteer && <section><h3 className="text-sm font-semibold">Donation status breakdown</h3><StatusBars statuses={report.statuses} /></section>}
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Trend records"><table className="records-table"><caption className="sr-only">Trend records by {report.bucket}, UTC</caption><thead><tr><th scope="col">Period</th>{(volunteer ? ['Collected', 'Delivered'] : ['Created', 'Completed', 'Portions shared']).map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{report.trends.map(row => <tr key={row.date}><th scope="row">{row.date}</th>{(volunteer ? [row.collected, row.delivered] : [row.posted, row.completed, row.portions]).map((value, i) => <td key={i}>{value.toLocaleString()}</td>)}</tr>)}</tbody></table></div>
        </div>
      </details>
      <p className="analytics-note"><Icon name="shield" width="15" />Calculated from your authorized records. Today’s totals may be incomplete.</p>
    </>}
  </DashboardView>
}
