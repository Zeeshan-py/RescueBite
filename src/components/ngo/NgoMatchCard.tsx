import { StatusBadge } from '../common/StatusBadge'
import { Link } from 'react-router-dom'
import { DonationStatusBadge } from '../donations/DonationStatusBadge'
import { Icon } from '../common/Icon'
import type { NgoDonationMatch } from '../../services/ngo/ngo-workflow.types'
import { formatDashboardDate } from '../../services/dashboard/dashboard.utils'

export function NgoMatchCard({ item }: { item: NgoDonationMatch }) {
  const score = Math.max(0, Math.min(100, item.matching_score))
  return <Link to={`/ngo/donations/${item.id}`} className="rescue-card">
    <div className="rescue-card-heading"><span className="rescue-card-icon"><Icon name="leaf" width="22" height="22" /></span><div><h2>{item.donation.food_type}</h2><p>{item.donation.meal_portions.toLocaleString()} portions · {item.donation.quantity.toLocaleString()} quantity</p></div><div className="match-score"><div className="score-ring"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="#e8eee9" strokeWidth="3" /><circle cx="24" cy="24" r="20" fill="none" stroke="#488968" strokeWidth="3" strokeDasharray={`${score / 100 * 125.66} 125.66`} transform="rotate(-90 24 24)" /></svg><strong>{Math.round(score)}</strong></div><span>Match score<br />out of 100</span></div></div>
    <div className="match-statuses"><span>Match <StatusBadge status={item.status} /></span><span>Donation <DonationStatusBadge status={item.donation.status} /></span></div>
    <dl className="rescue-card-details"><div><dt><Icon name="location" width="14" />Pickup location</dt><dd>{item.donation.location}</dd></div><div><dt><Icon name="clock" width="14" />Collection deadline</dt><dd>{formatDashboardDate(item.donation.collection_deadline)}</dd></div></dl>
    <div className="rescue-card-footer"><span>Review food details and suitability</span><span>View match <Icon name="arrow" width="15" /></span></div>
  </Link>
}
