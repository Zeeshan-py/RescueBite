import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { DashboardSection, DashboardView, SummaryCards } from '../../components/dashboard/DashboardView'
import { PickupTaskCard } from '../../components/pickups/PickupTaskCard'
import { PickupRouteMap } from '../../components/maps/PickupRouteMap'
import { getVolunteerDashboard } from '../../services/dashboard/dashboard.service'
import { isValidCoordinates } from '../../services/location/location.utils'
import { useDashboardQuery } from '../../services/dashboard/useDashboardQuery'
import { EmptyState } from '../../components/common/EmptyState'
import { Icon } from '../../components/common/Icon'

export default function VolunteerDashboardPage() {
  const { user } = useAuth()
  const load = useCallback(() => getVolunteerDashboard(user!.id), [user])
  const query = useDashboardQuery(load)
  const current = query.data?.assigned[0]
  return <DashboardView mobileTitle="Your pickups" eyebrow="VOLUNTEER OVERVIEW" title="Make the next rescue happen." description="Find available pickups, follow assigned rescues, and review your delivery history." actions={<Link to="/volunteer/pickups" className="button-primary"><Icon name="truck" width="17" />Browse pickups</Link>} {...query}>
    {query.data && <><SummaryCards summary={query.data.summary} /><div className="quick-links"><Link to="/volunteer/analytics"><Icon name="chart" width="16" />View my delivery impact<Icon name="arrow" width="14" /></Link></div>
      {!query.data.assigned.length && !query.data.available.length && !query.data.history.length && <div className="mt-8"><EmptyState title="No pickup tasks are available yet." /></div>}
      {query.data.assigned.length > 0 && <DashboardSection title="My assigned rescues">{query.data.assigned.map((task) => <div key={task.id}><PickupTaskCard task={task} /><Link to={`/volunteer/pickups/${task.id}`} className="mt-2 inline-block text-sm font-semibold text-forest underline">{task.status === 'ASSIGNED' ? 'View pickup and mark collected' : 'View delivery and mark delivered'} →</Link></div>)}</DashboardSection>}
      {current && <DashboardSection title="Current pickup and destination"><p className="text-sm text-muted">Receiving NGO: {query.data.destination?.organization_name ?? 'Destination details unavailable'}</p><PickupRouteMap pickup={isValidCoordinates(current.donation) ? current.donation : null} destination={isValidCoordinates(query.data.destination) ? query.data.destination : null} pickupLabel={current.pickup_location} destinationLabel={query.data.destination?.location ?? current.delivery_location} /></DashboardSection>}
      {query.data.available.length > 0 && <DashboardSection title="Available pickups · earliest deadlines"><div className="rescue-card-grid">{query.data.available.map((task) => <PickupTaskCard key={task.id} task={task} />)}</div></DashboardSection>}
      {query.data.history.length > 0 && <DashboardSection title="My recent history"><div className="rescue-card-grid">{query.data.history.map((task) => <PickupTaskCard key={task.id} task={task} />)}</div></DashboardSection>}</>}
  </DashboardView>
}
