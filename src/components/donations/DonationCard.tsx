import { Link } from 'react-router-dom'
import type { Donation } from '../../types/domain'
import { formatDashboardDate } from '../../services/dashboard/dashboard.utils'
import { DonationStatusBadge } from './DonationStatusBadge'
import { Icon } from '../common/Icon'

export function DonationCard({ donation }: { donation: Donation }) {
  return <Link to={`/donor/donations/${donation.id}`} className="rescue-card">
    <div className="rescue-card-heading"><span className="rescue-card-icon"><Icon name="box" width="22" height="22" /></span><div><h2>{donation.food_type}</h2><p>{donation.meal_portions.toLocaleString()} meal portions · {donation.quantity.toLocaleString()} quantity</p></div><DonationStatusBadge status={donation.status} /></div>
    <dl className="rescue-card-details"><div><dt><Icon name="location" width="14" />Pickup location</dt><dd>{donation.location}</dd></div><div><dt><Icon name="clock" width="14" />Collection deadline</dt><dd>{formatDashboardDate(donation.collection_deadline)}</dd></div></dl>
    <div className="rescue-card-footer"><span>Posted {new Date(donation.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><span>View donation <Icon name="arrow" width="15" /></span></div>
  </Link>
}
