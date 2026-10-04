import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LoadingState } from '../../components/common/LoadingState'
import { PickupStatusBadge } from '../../components/pickups/PickupStatusBadge'
import { claimPickupTask, getPickupTask, markPickupCollected } from '../../services/pickups/pickup.service'
import type { PickupTaskWithDonation } from '../../services/pickups/pickup.types'
import { isPickupClaimable } from '../../services/pickups/pickup.utils'
import { useAuth } from '../../auth/useAuth'
import { markDelivered } from '../../services/delivery/delivery.service'
import { canMarkDelivered } from '../../services/delivery/delivery.utils'
import { subscribeToDonationStatus, subscribeToPickupStatus, unsubscribeFromWorkflow } from '../../services/realtime/workflow-realtime.service'
import { getPickupDestination } from '../../services/delivery/delivery.service'
import type { NGO } from '../../types/domain'
import { ConfirmAction } from '../../components/common/ConfirmAction'
import { PickupRouteMap } from '../../components/maps/PickupRouteMap'

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
export default function PickupDetailsPage() {
  const { id } = useParams(), { user } = useAuth()
  const [task, setTask] = useState<PickupTaskWithDonation | null>(null), [loading, setLoading] = useState(true), [working, setWorking] = useState(false)
  const [receivingNgo, setReceivingNgo] = useState<Pick<NGO, 'id' | 'organization_name' | 'location' | 'latitude' | 'longitude'> | null>(null)
  const [error, setError] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null)
  useEffect(() => { if (!id) return; void getPickupTask(id).then(setTask).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)) }, [id])
  useEffect(() => {
    if (!id) return
    const channel = subscribeToPickupStatus(id, (updated) => setTask((current) => current ? { ...current, ...updated, donation: current.donation } : current))
    return () => { void unsubscribeFromWorkflow(channel) }
  }, [id])
  useEffect(() => {
    const donationId = task?.donation.id
    if (!donationId) return
    const channel = subscribeToDonationStatus(donationId, (donation) => setTask((current) => current ? { ...current, donation } : current))
    return () => { void unsubscribeFromWorkflow(channel) }
  }, [task?.donation.id])
  useEffect(() => {
    if (!task?.donation.id || !task.volunteer_id) return
    let active = true
    void getPickupDestination(task.donation.id).then((ngo) => { if (active) setReceivingNgo(ngo) }).catch(() => undefined)
    return () => { active = false }
  }, [task?.donation.id, task?.volunteer_id])
  async function act(action: 'CLAIM' | 'COLLECT' | 'DELIVER') {
    if (!id) return
    setWorking(true); setError(null); setMessage(null)
    try {
      const updated = action === 'CLAIM' ? await claimPickupTask(id) : action === 'COLLECT' ? await markPickupCollected(id) : await markDelivered(id)
      setTask(updated)
      setMessage(action === 'CLAIM' ? 'Pickup assigned to you.' : action === 'COLLECT' ? 'Food marked collected. It is ready for delivery.' : 'Delivery recorded. The receiving NGO can now confirm receipt.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The pickup action failed.') }
    finally { setWorking(false) }
  }
  if (loading) return <LoadingState label="Loading pickup details…" />
  if (!task) return <div><Link to="/volunteer/pickups" className="text-sm font-semibold text-forest">← Pickup tasks</Link><p role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error ?? 'Pickup task unavailable.'}</p></div>
  const donation = task.donation, mine = task.volunteer_id === user?.id, claimable = isPickupClaimable(task), deliverable = canMarkDelivered(task, user?.id ?? '')
  return <div><Link to="/volunteer/pickups" className="text-sm font-semibold text-forest hover:underline">← Pickup tasks</Link>{message && <p role="status" className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">{message}</p>}{error && <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}<div className="mt-8 flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Pickup task</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">{donation.food_type}</h1></div><PickupStatusBadge status={task.status} /></div>
    <section className="mt-8 rounded-2xl border border-line bg-white p-5 sm:p-8"><h2 className="text-lg font-semibold">Operational details</h2><dl className="mt-6 grid gap-5 sm:grid-cols-2">{[['Quantity', donation.quantity], ['Meal portions', donation.meal_portions], ['Pickup location', task.pickup_location], ['Delivery location', task.delivery_location], ['Available from', formatDate(donation.available_from)], ['Collection deadline', formatDate(donation.collection_deadline)], ['Claimed at', task.pickup_time ? formatDate(task.pickup_time) : 'Not claimed'], ['Collected at', task.collected_at ? formatDate(task.collected_at) : 'Not collected'], ['Delivered at', task.delivered_at ? formatDate(task.delivered_at) : 'Not delivered']].map(([label, value]) => <div key={label} className="border-b border-line pb-4"><dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt><dd className="mt-2 break-words text-sm">{String(value)}</dd></div>)}</dl><h2 className="mt-7 text-sm font-semibold">Food safety information</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{donation.safety_information || 'No additional safety information supplied.'}</p><div className="mt-7"><h2 className="mb-4 text-sm font-semibold">Pickup and destination map</h2><PickupRouteMap pickup={donation.latitude !== null && donation.longitude !== null ? { latitude: donation.latitude, longitude: donation.longitude } : null} destination={receivingNgo?.latitude !== null && receivingNgo?.latitude !== undefined && receivingNgo.longitude !== null ? { latitude: receivingNgo.latitude, longitude: receivingNgo.longitude } : null} pickupLabel={task.pickup_location} destinationLabel={receivingNgo?.location ?? task.delivery_location} /></div></section>
    {claimable && <div className="mt-6"><ConfirmAction label="Claim pickup" title="Take responsibility for this pickup?" description="This task will be assigned to you. Confirm that you can collect and deliver it before the deadline. There is no unclaim action on this page." disabled={working} onConfirm={() => act('CLAIM')} /></div>}{mine && task.status === 'ASSIGNED' && <div className="mt-6"><ConfirmAction label="Mark collected" title="Confirm food collection?" description="Only continue if you have received the food from the donor. This records the collection time and moves the rescue to delivery. It cannot be undone here." disabled={working} onConfirm={() => act('COLLECT')} /></div>}{deliverable && <div className="mt-6"><ConfirmAction label="Mark as delivered" title="Confirm delivery to the NGO?" description="Only continue after handing over the food. This records delivery; the NGO must still confirm receipt to complete the rescue. It cannot be undone here." disabled={working} onConfirm={() => act('DELIVER')} /></div>}{task.status === 'DELIVERED' && <p className="mt-6 rounded-xl border border-line bg-white p-5 text-sm text-muted">Delivery recorded. The receiving NGO is responsible for final receipt confirmation.</p>}
  </div>
}
