import { useEffect, useState } from 'react'
import { confirmReceipt, getDeliveryStatus } from '../../services/delivery/delivery.service'
import type { DeliveryStatus } from '../../services/delivery/delivery.types'
import { canConfirmReceipt } from '../../services/delivery/delivery.utils'
import type { Donation } from '../../types/domain'
import { PickupStatusBadge } from './PickupStatusBadge'
import { ConfirmAction } from '../common/ConfirmAction'
import { PickupRouteMap } from '../maps/PickupRouteMap'

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function PickupSummary({ donation, canConfirm = false, onDonationChange }: { donation: Donation; canConfirm?: boolean; onDonationChange?: (donation: Donation) => void }) {
  const [delivery, setDelivery] = useState<DeliveryStatus>({ pickup: null, receivingNgo: null })
  const [working, setWorking] = useState(false), [error, setError] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null)
  useEffect(() => { let active = true; void getDeliveryStatus(donation.id).then((value) => { if (active) setDelivery(value) }).catch(() => undefined); return () => { active = false } }, [donation.id])
  const task = delivery.pickup
  if (!task && !delivery.receivingNgo) return null

  async function handleConfirm() {
    setWorking(true); setError(null); setMessage(null)
    try {
      const updated = await confirmReceipt(donation.id)
      onDonationChange?.(updated)
      setMessage('Receipt confirmed. This rescue is now complete.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Receipt could not be confirmed.') }
    finally { setWorking(false) }
  }

  return <section aria-labelledby="pickup-heading" className="mt-5 rounded-xl border border-line bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="pickup-heading" className="text-base font-semibold">Delivery progress</h2>{task && <PickupStatusBadge status={task.status} />}</div>
    {message && <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">{message}</p>}
    {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
      {task && <><div><dt className="text-xs text-muted">Pickup location</dt><dd className="mt-1 font-medium">{task.pickup_location}</dd></div><div><dt className="text-xs text-muted">Delivery location</dt><dd className="mt-1 font-medium">{task.delivery_location}</dd></div><div><dt className="text-xs text-muted">Volunteer</dt><dd className="mt-1 font-medium">{task.volunteer_id ? 'Assigned' : 'Awaiting volunteer'}</dd></div><div><dt className="text-xs text-muted">Collected</dt><dd className="mt-1 font-medium">{task.collected_at ? formatDate(task.collected_at) : 'Not collected'}</dd></div><div><dt className="text-xs text-muted">Delivered</dt><dd className="mt-1 font-medium">{task.delivered_at ? formatDate(task.delivered_at) : 'Not delivered'}</dd></div></>}
      {delivery.receivingNgo && <div><dt className="text-xs text-muted">Receiving NGO</dt><dd className="mt-1 font-medium">{delivery.receivingNgo.organization_name}</dd></div>}
      <div><dt className="text-xs text-muted">Completed</dt><dd className="mt-1 font-medium">{donation.completed_at ? formatDate(donation.completed_at) : 'Awaiting NGO confirmation'}</dd></div>
    </dl>
    <div className="mt-6"><PickupRouteMap pickup={donation.latitude !== null && donation.longitude !== null ? { latitude: donation.latitude, longitude: donation.longitude } : null} destination={delivery.receivingNgo?.latitude !== null && delivery.receivingNgo?.latitude !== undefined && delivery.receivingNgo.longitude !== null ? { latitude: delivery.receivingNgo.latitude, longitude: delivery.receivingNgo.longitude } : null} pickupLabel={donation.location} destinationLabel={delivery.receivingNgo?.location ?? task?.delivery_location ?? 'Receiving NGO'} /></div>
    {canConfirm && canConfirmReceipt(donation, task) && <div className="mt-6"><ConfirmAction label="Confirm receipt" title="Complete this rescue?" description="Confirm that your organization has received the delivery. This marks the donation completed and includes it in confirmed impact totals. It cannot be undone here." disabled={working} onConfirm={handleConfirm} /></div>}
  </section>
}
