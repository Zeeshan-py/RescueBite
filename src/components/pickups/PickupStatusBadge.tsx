import type { PickupTaskStatus } from '../../types/domain'

const styles: Record<PickupTaskStatus, string> = { AVAILABLE: 'bg-amber-50 text-amber-800', ASSIGNED: 'bg-blue-50 text-blue-800', COLLECTED: 'bg-violet-50 text-violet-800', DELIVERED: 'bg-emerald-50 text-emerald-800', CANCELLED: 'bg-red-50 text-red-800' }
export function PickupStatusBadge({ status }: { status: PickupTaskStatus }) { return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>{status}</span> }
