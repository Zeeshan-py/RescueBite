import type { DonationStatus } from '../../types/domain'

const colors: Record<DonationStatus, string> = {
  POSTED: 'bg-blue-50 text-blue-800', MATCHED: 'bg-violet-50 text-violet-800',
  ACCEPTED: 'bg-emerald-50 text-emerald-800', PICKUP_ASSIGNED: 'bg-cyan-50 text-cyan-800',
  COLLECTED: 'bg-teal-50 text-teal-800', DELIVERED: 'bg-lime/55 text-pine',
  COMPLETED: 'bg-green-100 text-green-900', CANCELLED: 'bg-stone-100 text-stone-700',
  EXPIRED: 'bg-amber-50 text-amber-900', EXCEPTION: 'bg-red-50 text-red-800',
}

export function DonationStatusBadge({ status }: { status: DonationStatus }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${colors[status]}`}>{status.replace('_', ' ')}</span>
}

