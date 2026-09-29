import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { LoadingState } from '../../components/common/LoadingState'
import { getPickupTasks } from '../../services/pickups/pickup.service'
import type { PickupTaskWithDonation } from '../../services/pickups/pickup.types'
import { groupPickupTasks } from '../../services/pickups/pickup.utils'

export default function VolunteerDashboardPage() {
  const { profile, user } = useAuth()
  const [tasks, setTasks] = useState<PickupTaskWithDonation[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null)
  useEffect(() => { void getPickupTasks().then(setTasks).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)) }, [])
  const groups = useMemo(() => groupPickupTasks(tasks, user?.id ?? ''), [tasks, user?.id])
  if (loading) return <LoadingState label="Loading your pickup workspace…" />
  return <div><p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Volunteer workspace</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">Hello, {profile?.name?.split(' ')[0] ?? 'there'}.</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted">Claim an available rescue, collect it before the deadline, and record delivery to the receiving NGO.</p>{error && <p role="alert" className="mt-7 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}{!error && <><div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Available pickups', groups.available.length], ['Assigned to me', groups.assigned.length], ['Ready to deliver', groups.collected.length], ['Delivered', groups.delivered.length]].map(([label, value]) => <div key={label} className="rounded-xl border border-line bg-white p-5"><p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p><p className="mt-3 font-display text-4xl text-pine">{value}</p></div>)}</div><Link to="/volunteer/pickups" className="mt-7 inline-flex rounded-lg bg-pine px-5 py-3 text-sm font-semibold text-white">Open pickup tasks</Link></>}</div>
}
