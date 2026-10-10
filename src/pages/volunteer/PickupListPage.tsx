import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { LoadingState } from '../../components/common/LoadingState'
import { PickupTaskCard } from '../../components/pickups/PickupTaskCard'
import { getPickupTasks } from '../../services/pickups/pickup.service'
import type { PickupTaskWithDonation } from '../../services/pickups/pickup.types'
import { groupPickupTasks } from '../../services/pickups/pickup.utils'

export default function PickupListPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<PickupTaskWithDonation[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null)
  useEffect(() => { void getPickupTasks().then(setTasks).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)) }, [])
  const groups = useMemo(() => groupPickupTasks(tasks, user?.id ?? ''), [tasks, user?.id])
  if (loading) return <LoadingState label="Loading pickup tasks…" />
  const sections: Array<[string, PickupTaskWithDonation[], string]> = [['Available pickups', groups.available, 'Unclaimed rescues before their collection deadline.'], ['Assigned to me', groups.assigned, 'Pickups you have claimed and can mark collected.'], ['Collected', groups.collected, 'Collected food ready to be delivered to its NGO.'], ['Delivered', groups.delivered, 'Deliveries recorded and awaiting or finished with NGO confirmation.'], ['Unavailable', groups.unavailable, 'Expired opportunities kept for context.']]
  return <div><p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Volunteer</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">Pickup tasks</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted">Claim an available pickup or review your assigned tasks.</p>{error ? <p role="alert" className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : sections.map(([title, items, description]) => <section key={title} className="mt-9"><h2 className="text-xl font-semibold">{title} <span className="text-sm text-muted">({items.length})</span></h2><p className="mt-1 text-sm text-muted">{description}</p>{items.length ? <div className="rescue-card-grid">{items.map((task) => <PickupTaskCard key={task.id} task={task} />)}</div> : <p className="mt-4 rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">No tasks in this section.</p>}</section>)}</div>
}
