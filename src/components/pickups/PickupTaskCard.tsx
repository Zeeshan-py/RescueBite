import { Link } from 'react-router-dom'
import type { PickupTaskWithDonation } from '../../services/pickups/pickup.types'
import { PickupStatusBadge } from './PickupStatusBadge'
import { Icon } from '../common/Icon'
import { formatDashboardDate } from '../../services/dashboard/dashboard.utils'

export function PickupTaskCard({ task }: { task: PickupTaskWithDonation }) {
  return <Link to={`/volunteer/pickups/${task.id}`} className="rescue-card">
    <div className="rescue-card-heading"><span className="rescue-card-icon"><Icon name="truck" width="22" height="22" /></span><div><h2>{task.donation.food_type}</h2><p>{task.donation.meal_portions.toLocaleString()} portions · {task.donation.quantity.toLocaleString()} quantity</p></div><PickupStatusBadge status={task.status} /></div>
    <dl className="pickup-route"><div><dt>Pickup</dt><dd>{task.pickup_location}</dd></div><div><dt>Deliver to</dt><dd>{task.delivery_location}</dd></div></dl>
    <div className="rescue-card-footer"><span><Icon name="clock" width="14" />{formatDashboardDate(task.donation.collection_deadline)}</span><span>View pickup <Icon name="arrow" width="15" /></span></div>
  </Link>
}
