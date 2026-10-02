import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { DashboardSection, DashboardView, SummaryCards } from '../../components/dashboard/DashboardView'
import { PickupTaskCard } from '../../components/pickups/PickupTaskCard'
import { PickupRouteMap } from '../../components/maps/PickupRouteMap'
import { getVolunteerDashboard } from '../../services/dashboard/dashboard.service'
import { isValidCoordinates } from '../../services/location/location.utils'
import { useDashboardQuery } from '../../services/dashboard/useDashboardQuery'

export default function VolunteerDashboardPage() {
  const { user } = useAuth()
  const load = useCallback(() => getVolunteerDashboard(user!.id), [user])
  const query = useDashboardQuery(load)
  const current = query.data?.assigned[0]
  return <DashboardView title="Volunteer workspace" description="Find available pickups, follow assigned rescues, and review your delivery history." {...query}>
    {query.data && <><SummaryCards summary={query.data.summary} /><Link to="/volunteer/analytics" className="mt-5 inline-block text-sm font-semibold text-forest underline">View my analytics and impact →</Link><Link to="/volunteer/pickups" className="mt-6 inline-block rounded-lg bg-pine px-5 py-3 text-sm font-semibold text-white">Browse available pickups</Link>
      <DashboardSection title="My assigned rescues" empty={!query.data.assigned.length ? 'No active assignments. Browse available pickups to help.' : undefined}>{query.data.assigned.map((task) => <div key={task.id}><PickupTaskCard task={task} /><Link to={`/volunteer/pickups/${task.id}`} className="mt-2 inline-block text-sm font-semibold text-forest underline">{task.status === 'ASSIGNED' ? 'View pickup and mark collected' : 'View delivery and mark delivered'} →</Link></div>)}</DashboardSection>
      {current && <DashboardSection title="Current pickup and destination"><p className="text-sm text-muted">Receiving NGO: {query.data.destination?.organization_name ?? 'Destination details unavailable'}</p><PickupRouteMap pickup={isValidCoordinates(current.donation) ? current.donation : null} destination={isValidCoordinates(query.data.destination) ? query.data.destination : null} pickupLabel={current.pickup_location} destinationLabel={query.data.destination?.location ?? current.delivery_location} /></DashboardSection>}
      <DashboardSection title="Available pickups · earliest deadlines" empty={!query.data.available.length ? 'No eligible pickups are currently available.' : undefined}>{query.data.available.map((task) => <PickupTaskCard key={task.id} task={task} />)}</DashboardSection>
      <DashboardSection title="My recent history" empty={!query.data.history.length ? 'No completed or cancelled pickups yet.' : undefined}>{query.data.history.map((task) => <PickupTaskCard key={task.id} task={task} />)}</DashboardSection></>}
  </DashboardView>
}
