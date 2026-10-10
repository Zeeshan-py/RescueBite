import { useEffect, useId, useRef, useState } from 'react'
import type { ImpactTrend } from '../../services/analytics/analytics.types'
import { Icon } from '../common/Icon'

const number = new Intl.NumberFormat()
function labelDate(date: string, bucket: string) {
  return new Intl.DateTimeFormat(undefined, bucket === 'year' ? { year: 'numeric', timeZone: 'UTC' }
    : bucket === 'month' ? { month: 'short', year: '2-digit', timeZone: 'UTC' }
      : { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

export function ActivityChart({ trends, bucket, volunteer = false }: {
  trends: ImpactTrend[]; bucket: 'day' | 'month' | 'year'; volunteer?: boolean
}) {
  const [mode, setMode] = useState<'activity' | 'impact'>('activity')
  const [selected, setSelected] = useState<number | null>(null)
  const [width, setWidth] = useState(800)
  const plot = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = plot.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(Math.max(260, Math.round(entry.contentRect.width))) })
    observer.observe(element)
    return () => observer.disconnect()
  }, [trends, mode])
  const gradientId = useId()
  const impact = mode === 'impact'
  const series: Array<{ key: keyof Omit<ImpactTrend, 'date'>; label: string; color: string }> = impact
    ? [{ key: 'portions', label: 'Redistributed portions', color: '#176b4d' }]
    : volunteer ? [{ key: 'collected', label: 'Collected', color: '#627f72' }, { key: 'delivered', label: 'Delivered', color: '#176b4d' }]
      : [{ key: 'posted', label: 'Created', color: '#627f72' }, { key: 'completed', label: 'Completed', color: '#176b4d' }]
  const rawMax = Math.max(1, ...trends.flatMap(row => series.map(s => row[s.key])))
  const magnitude = 10 ** Math.floor(Math.log10(rawMax))
  const max = Math.ceil(rawMax / magnitude / 2) * magnitude * 2
  const height = 274, left = 42, right = 16, top = 22, bottom = 38
  const plotWidth = width - left - right, plotHeight = height - top - bottom
  const x = (i: number) => left + (trends.length === 1 ? plotWidth / 2 : i / Math.max(1, trends.length - 1) * plotWidth)
  const y = (value: number) => top + plotHeight - value / max * plotHeight
  const lastActive = trends.reduce((last, row, i) => series.some(s => row[s.key] > 0) ? i : last, -1)
  const index = Math.max(0, Math.min(selected ?? Math.max(0, lastActive), trends.length - 1))
  const current = trends[index]
  const hasValues = trends.some(row => series.some(s => row[s.key] > 0))
  const ticks = [...new Set(width < 420 ? [0, Math.round((trends.length - 1) / 2), trends.length - 1]
    : [0, Math.round((trends.length - 1) / 3), Math.round(2 * (trends.length - 1) / 3), trends.length - 1])].filter(i => i >= 0)
  return <section className="surface trend-panel" aria-labelledby={`${gradientId}-heading`}>
    <div className="panel-heading"><div><p className="eyebrow">PROGRESS OVER TIME</p><h2 id={`${gradientId}-heading`}>{volunteer ? 'Your delivery activity' : 'Rescue activity'}</h2></div>
      {!volunteer && <div className="segmented-control" aria-label="Chart metric"><button type="button" aria-pressed={!impact} onClick={() => { setMode('activity'); setSelected(null) }}>Donations</button><button type="button" aria-pressed={impact} onClick={() => { setMode('impact'); setSelected(null) }}>Food impact</button></div>}
    </div>
    <div className="chart-legend">{series.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}<span className="chart-granularity">{bucket === 'day' ? 'Daily' : bucket === 'month' ? 'Monthly' : 'Yearly'} totals · UTC</span></div>
    {!hasValues ? <div className="chart-empty"><Icon name="chart" width="30" height="30" /><strong>No {impact ? 'confirmed redistribution' : 'activity'} in this period</strong><p>Choose a longer reporting period to explore earlier rescues.</p></div> : <>
      <div ref={plot} className="chart-interaction" tabIndex={0} role="group" aria-label="Activity chart. Use left and right arrow keys to explore periods." onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setSelected(Math.max(0, Math.min(trends.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))) }
      }}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={series.map(s => `${s.label}: ${number.format(trends.reduce((sum, row) => sum + row[s.key], 0))} across the reporting period`).join('. ')}
          onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); const localX = (event.clientX - rect.left) / rect.width * width; setSelected(Math.max(0, Math.min(trends.length - 1, Math.round((localX - left) / plotWidth * (trends.length - 1))))) }}>
          <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#409778" stopOpacity=".2" /><stop offset="100%" stopColor="#409778" stopOpacity=".015" /></linearGradient></defs>
          {[0, 1, 2, 3, 4].map(tick => <g key={tick}><line x1={left} x2={width - right} y1={y(max * tick / 4)} y2={y(max * tick / 4)} className="chart-gridline" /><text x={left - 12} y={y(max * tick / 4) + 4} textAnchor="end" className="chart-axis">{Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(max * tick / 4)}</text></g>)}
          {series.map((s, seriesIndex) => {
            const points = trends.map((row, i) => `${x(i)},${y(row[s.key])}`).join(' ')
            const main = seriesIndex === series.length - 1
            return <g key={s.key}>{main && trends.length > 1 && <polygon points={`${x(0)},${y(0)} ${points} ${x(trends.length - 1)},${y(0)}`} fill={`url(#${gradientId})`} />}<polyline points={points} fill="none" stroke={s.color} strokeWidth={main ? 3 : 2} strokeDasharray={main ? undefined : '5 5'} strokeLinejoin="round" strokeLinecap="round" />{trends.length === 1 && trends[0] && <circle cx={x(0)} cy={y(trends[0][s.key])} r="5" fill={s.color} />}</g>
          })}
          {current && <g><line x1={x(index)} x2={x(index)} y1={top} y2={y(0)} stroke="#b1c8bc" strokeDasharray="3 5" />{series.map(s => <circle key={s.key} cx={x(index)} cy={y(current[s.key])} r="5" fill={s.color} stroke="white" strokeWidth="2.5" />)}</g>}
          {ticks.map(i => trends[i] && <text key={i} x={x(i)} y={height - 10} textAnchor={i === 0 ? 'start' : i === trends.length - 1 ? 'end' : 'middle'} className="chart-axis">{labelDate(trends[i].date, bucket)}</text>)}
        </svg>
      </div>
      <div className="chart-readout" aria-live="polite"><span>{current ? labelDate(current.date, bucket) : 'No period selected'}</span>{current && series.map(s => <span key={s.key}><i style={{ background: s.color }} /><strong>{number.format(current[s.key])}</strong> {s.label.toLowerCase()}</span>)}<span className="chart-hint">Hover or use arrow keys</span></div>
    </>}
    <p className="panel-footnote">{volunteer ? 'Collections and deliveries are counted on the date each event occurred.' : 'Created and completed totals use their respective event dates. Food impact counts confirmed portions.'}</p>
  </section>
}

export function OutcomeChart({ statuses }: { statuses: Record<string, number> }) {
  const total = Object.values(statuses).reduce((sum, value) => sum + value, 0)
  const groups = [
    { label: 'Completed', value: statuses.COMPLETED ?? 0, color: '#176b4d' },
    { label: 'In progress', value: ['POSTED', 'MATCHED', 'ACCEPTED', 'PICKUP_ASSIGNED', 'COLLECTED', 'DELIVERED'].reduce((sum, key) => sum + (statuses[key] ?? 0), 0), color: '#7ca68e' },
    { label: 'Cancelled or expired', value: (statuses.CANCELLED ?? 0) + (statuses.EXPIRED ?? 0), color: '#ddb46f' },
    { label: 'Needs attention', value: statuses.EXCEPTION ?? 0, color: '#c77366' },
  ]
  const circumference = 2 * Math.PI * 68
  return <section className="surface outcomes-panel"><div className="panel-heading"><div><p className="eyebrow">THE BIG PICTURE</p><h2>Donation outcomes</h2></div><Icon name="box" /></div>
    <div className="outcomes-content"><div className="donut-wrap"><svg viewBox="0 0 180 180" role="img" aria-label={total ? groups.map(g => `${g.label}: ${g.value}`).join(', ') : 'No donations in the selected period'}><circle cx="90" cy="90" r="68" fill="none" stroke="#edf2ee" strokeWidth="19" />{groups.map((g, i) => {
      const offset = groups.slice(0, i).reduce((sum, segment) => sum + segment.value, 0) / Math.max(1, total) * circumference
      return g.value > 0 && <circle key={g.label} cx="90" cy="90" r="68" fill="none" stroke={g.color} strokeWidth="19" strokeDasharray={`${Math.max(0, g.value / total * circumference - 3)} ${circumference}`} strokeDashoffset={-offset} transform="rotate(-90 90 90)" />
    })}</svg><div className="donut-value"><strong>{number.format(total)}</strong><span>total donations</span></div></div>
      <dl className="outcome-legend">{groups.map(g => <div key={g.label}><dt><i style={{ background: g.color }} />{g.label}</dt><dd>{number.format(g.value)}<span>{total ? Math.round(g.value / total * 100) : 0}%</span></dd></div>)}</dl>
    </div><p className="panel-footnote">Current status of donations created in the selected period.</p>
  </section>
}

export function StatusBars({ statuses }: { statuses: Record<string, number> }) {
  const order = ['POSTED', 'MATCHED', 'ACCEPTED', 'PICKUP_ASSIGNED', 'COLLECTED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'EXCEPTION']
  const entries = Object.entries(statuses).filter(([, value]) => value > 0).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
  const max = Math.max(1, ...entries.map(([, value]) => value))
  return <div className="status-bars">{entries.map(([status, value]) => <div key={status}><div><span>{status.toLowerCase().replaceAll('_', ' ')}</span><strong>{number.format(value)}</strong></div><div className="bar-track" aria-hidden="true"><span style={{ width: `${value / max * 100}%` }} /></div></div>)}</div>
}
