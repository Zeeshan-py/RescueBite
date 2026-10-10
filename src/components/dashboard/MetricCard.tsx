import { Icon, type IconName } from '../common/Icon'

export function MetricCard({ label, value, note, icon = 'chart', accent = false }: {
  label: string; value: number; note?: string; icon?: IconName; accent?: boolean
}) {
  return <div className={`metric-card${accent ? ' metric-card-accent' : ''}`}>
    <dt className="metric-top"><span>{label}</span><span className="metric-icon"><Icon name={icon} /></span></dt>
    <dd>{value.toLocaleString()}{note && <p>{note}</p>}</dd>
  </div>
}
