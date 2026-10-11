import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { DashboardSection, DashboardView, SummaryCards } from '../../components/dashboard/DashboardView'
import { DonationCard } from '../../components/donations/DonationCard'
import { Icon } from '../../components/common/Icon'
import { getDonorDashboard } from '../../services/dashboard/dashboard.service'
import { useDashboardQuery } from '../../services/dashboard/useDashboardQuery'

export default function DonorDashboardPage() {
  const { profile, user } = useAuth()
  const load = useCallback(() => getDonorDashboard(user!.id), [user])
  const query = useDashboardQuery(load)
  return <DashboardView eyebrow="DONOR OVERVIEW" title={`Hello, ${profile?.name.split(' ')[0] ?? 'there'}.`} actions={<Link to="/donor/donations/new" className="button-primary"><Icon name="plus" width="17" />Create donation</Link>} {...query}>
    {query.data && <><SummaryCards summary={query.data.summary} /><div className="quick-links"><Link to="/donor/analytics"><Icon name="chart" width="16" />View my impact<Icon name="arrow" width="14" /></Link><Link to="/donor/donations">All donations<Icon name="arrow" width="14" /></Link></div>
      <DashboardSection title="Recent donations" empty={!query.data.recent.length ? 'No donations yet. Create your first donation to begin a rescue.' : undefined}><div className="rescue-card-grid">{query.data.recent.map((donation) => <DonationCard key={donation.id} donation={donation} />)}</div></DashboardSection></>}
  </DashboardView>
}
