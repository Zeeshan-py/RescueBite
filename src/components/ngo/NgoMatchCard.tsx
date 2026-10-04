import { StatusBadge } from '../common/StatusBadge'
import { Link } from 'react-router-dom'
import { DonationStatusBadge } from '../donations/DonationStatusBadge'
import type { NgoDonationMatch } from '../../services/ngo/ngo-workflow.types'

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function NgoMatchCard({ item }: { item: NgoDonationMatch }) {
  return <Link to={`/ngo/donations/${item.id}`} className="block rounded-xl border border-line bg-white p-5 transition hover:border-forest/40 hover:shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-wide text-forest uppercase"><StatusBadge status={item.status} /></p><h2 className="mt-2 text-lg font-semibold">{item.donation.food_type}</h2><p className="mt-1 text-sm text-muted">{item.donation.meal_portions} portions · {item.donation.quantity} quantity</p></div><div className="text-right"><DonationStatusBadge status={item.donation.status} /><p className="mt-3 font-display text-3xl text-forest">{item.matching_score}%</p></div></div>
    <dl className="mt-5 grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted">Pickup location</dt><dd className="mt-1 font-medium">{item.donation.location}</dd></div><div><dt className="text-xs text-muted">Collection deadline</dt><dd className="mt-1 font-medium">{formatDate(item.donation.collection_deadline)}</dd></div></dl>
  </Link>
}
