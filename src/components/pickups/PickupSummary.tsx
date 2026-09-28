import { useEffect, useState } from 'react'
import { getPickupForDonation } from '../../services/pickups/pickup.service'
import type { PickupTask } from '../../types/domain'
import { PickupStatusBadge } from './PickupStatusBadge'

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
export function PickupSummary({ donationId }: { donationId: string }) {
  const [task, setTask] = useState<PickupTask | null>(null)
  useEffect(() => { let active = true; void getPickupForDonation(donationId).then((value) => { if (active) setTask(value) }).catch(() => undefined); return () => { active = false } }, [donationId])
  if (!task) return null
  return <section aria-labelledby="pickup-heading" className="mt-5 rounded-xl border border-line bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="pickup-heading" className="text-base font-semibold">Pickup progress</h2><PickupStatusBadge status={task.status} /></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted">Pickup location</dt><dd className="mt-1 font-medium">{task.pickup_location}</dd></div><div><dt className="text-xs text-muted">Delivery location</dt><dd className="mt-1 font-medium">{task.delivery_location}</dd></div><div><dt className="text-xs text-muted">Claimed</dt><dd className="mt-1 font-medium">{task.pickup_time ? formatDate(task.pickup_time) : 'Awaiting volunteer'}</dd></div><div><dt className="text-xs text-muted">Collected</dt><dd className="mt-1 font-medium">{task.collected_at ? formatDate(task.collected_at) : 'Not collected'}</dd></div></dl></section>
}
