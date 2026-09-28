import { Link } from 'react-router-dom'
import type { PickupTaskWithDonation } from '../../services/pickups/pickup.types'
import { PickupStatusBadge } from './PickupStatusBadge'

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
export function PickupTaskCard({ task }: { task: PickupTaskWithDonation }) {
  return <Link to={`/volunteer/pickups/${task.id}`} className="block rounded-xl border border-line bg-white p-5 transition hover:border-forest/40 hover:shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-wide text-forest uppercase">Pickup task</p><h2 className="mt-2 text-lg font-semibold">{task.donation.food_type}</h2><p className="mt-1 text-sm text-muted">{task.donation.meal_portions} portions · {task.donation.quantity} quantity</p></div><PickupStatusBadge status={task.status} /></div><dl className="mt-5 grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted">Pickup</dt><dd className="mt-1 font-medium">{task.pickup_location}</dd></div><div><dt className="text-xs text-muted">Deliver to</dt><dd className="mt-1 font-medium">{task.delivery_location}</dd></div><div><dt className="text-xs text-muted">Deadline</dt><dd className="mt-1 font-medium">{formatDate(task.donation.collection_deadline)}</dd></div></dl></Link>
}
