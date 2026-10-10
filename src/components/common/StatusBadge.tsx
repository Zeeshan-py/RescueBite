import type { DonationStatus, MatchStatus, PickupTaskStatus } from '../../types/domain'

type Status = DonationStatus | MatchStatus | PickupTaskStatus
const styles: Record<Status, string> = {
  POSTED: 'bg-blue-50 text-blue-800', AVAILABLE: 'bg-blue-50 text-blue-800',
  MATCHED: 'bg-violet-50 text-violet-800', SUGGESTED: 'bg-violet-50 text-violet-800', VIEWED: 'bg-violet-50 text-violet-800',
  ACCEPTED: 'bg-emerald-50 text-emerald-800',
  PICKUP_ASSIGNED: 'bg-cyan-50 text-cyan-800', ASSIGNED: 'bg-cyan-50 text-cyan-800',
  COLLECTED: 'bg-teal-50 text-teal-800', DELIVERED: 'bg-lime text-pine', COMPLETED: 'bg-green-100 text-green-900',
  CANCELLED: 'bg-stone-100 text-stone-800', REJECTED: 'bg-red-50 text-red-800',
  EXPIRED: 'bg-amber-50 text-amber-900', EXCEPTION: 'bg-red-50 text-red-800',
}
export function StatusBadge({ status }: { status: Status }) {
  return <span className={`inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-semibold leading-5 ${styles[status]}`}><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current opacity-70" />{status.charAt(0) + status.slice(1).toLowerCase().replaceAll('_', ' ')}</span>
}
