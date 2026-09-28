import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LoadingState } from '../../components/common/LoadingState'
import { PickupStatusBadge } from '../../components/pickups/PickupStatusBadge'
import { claimPickupTask, getPickupTask, markPickupCollected } from '../../services/pickups/pickup.service'
import type { PickupTaskWithDonation } from '../../services/pickups/pickup.types'
import { isPickupClaimable } from '../../services/pickups/pickup.utils'
import { useAuth } from '../../auth/useAuth'

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
export default function PickupDetailsPage() {
  const { id } = useParams(), { user } = useAuth()
  const [task, setTask] = useState<PickupTaskWithDonation | null>(null), [loading, setLoading] = useState(true), [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null)
  useEffect(() => { if (!id) return; void getPickupTask(id).then(setTask).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)) }, [id])
  async function act(action: 'CLAIM' | 'COLLECT') { if (!id) return; setWorking(true); setError(null); setMessage(null); try { const updated = action === 'CLAIM' ? await claimPickupTask(id) : await markPickupCollected(id); setTask(updated); setMessage(action === 'CLAIM' ? 'Pickup assigned to you.' : 'Food marked collected. It is ready for the Phase 8 delivery workflow.') } catch (reason) { setError(reason instanceof Error ? reason.message : 'The pickup action failed.') } finally { setWorking(false) } }
  if (loading) return <LoadingState label="Loading pickup details…" />
  if (!task) return <div><Link to="/volunteer/pickups" className="text-sm font-semibold text-forest">← Pickup tasks</Link><p role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error ?? 'Pickup task unavailable.'}</p></div>
  const donation = task.donation, mine = task.volunteer_id === user?.id, claimable = isPickupClaimable(task)
  return <div><Link to="/volunteer/pickups" className="text-sm font-semibold text-forest hover:underline">← Pickup tasks</Link>{message && <p role="status" className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">{message}</p>}{error && <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}<div className="mt-8 flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Pickup task</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">{donation.food_type}</h1></div><PickupStatusBadge status={task.status} /></div>
    <section className="mt-8 rounded-2xl border border-line bg-white p-5 sm:p-8"><h2 className="text-lg font-semibold">Operational details</h2><dl className="mt-6 grid gap-5 sm:grid-cols-2">{[['Quantity', donation.quantity], ['Meal portions', donation.meal_portions], ['Pickup location', task.pickup_location], ['Delivery location', task.delivery_location], ['Available from', formatDate(donation.available_from)], ['Collection deadline', formatDate(donation.collection_deadline)], ['Claimed at', task.pickup_time ? formatDate(task.pickup_time) : 'Not claimed'], ['Collected at', task.collected_at ? formatDate(task.collected_at) : 'Not collected']].map(([label, value]) => <div key={label} className="border-b border-line pb-4"><dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt><dd className="mt-2 break-words text-sm">{String(value)}</dd></div>)}</dl><h2 className="mt-7 text-sm font-semibold">Food safety information</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{donation.safety_information || 'No additional safety information supplied.'}</p></section>
    {claimable && <button disabled={working} onClick={() => void act('CLAIM')} className="mt-6 rounded-lg bg-pine px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{working ? 'Claiming…' : 'Claim pickup'}</button>}{mine && task.status === 'ASSIGNED' && <button disabled={working} onClick={() => void act('COLLECT')} className="mt-6 rounded-lg bg-pine px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{working ? 'Updating…' : 'Mark collected'}</button>}{task.status === 'COLLECTED' && <p className="mt-6 rounded-xl border border-line bg-white p-5 text-sm text-muted">Collection recorded. Delivery and completion controls are intentionally reserved for Phase 8.</p>}
  </div>
}
