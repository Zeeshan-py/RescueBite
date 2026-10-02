import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { DashboardSection, DashboardView, SummaryCards } from '../../components/dashboard/DashboardView'
import { DonationStatusBadge } from '../../components/donations/DonationStatusBadge'
import { getDonorDashboard } from '../../services/dashboard/dashboard.service'
import { formatDashboardDate } from '../../services/dashboard/dashboard.utils'
import { useDashboardQuery } from '../../services/dashboard/useDashboardQuery'

export default function DonorDashboardPage() {
  const { profile, user } = useAuth()
  const load = useCallback(() => getDonorDashboard(user!.id), [user])
  const query = useDashboardQuery(load)
  return <DashboardView title={`Hello, ${profile?.name.split(' ')[0] ?? 'there'}.`} description="Your donation overview, from posting to confirmed receipt." {...query}>
    {query.data && <><SummaryCards summary={query.data.summary} /><Link to="/donor/analytics" className="mt-5 inline-block text-sm font-semibold text-forest underline">View my analytics and impact →</Link><div className="mt-6 flex flex-wrap gap-3"><Link to="/donor/donations/new" className="rounded-lg bg-pine px-5 py-3 text-sm font-semibold text-white">Create donation</Link><Link to="/donor/donations" className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-forest">View donations</Link></div>
      <DashboardSection title="Recent donations" empty={!query.data.recent.length ? 'No donations yet. Create your first donation to begin a rescue.' : undefined}>{query.data.recent.map((donation) => <Link key={donation.id} to={`/donor/donations/${donation.id}`} className="rounded-xl border border-line bg-white p-5 hover:border-forest"><div className="flex flex-wrap justify-between gap-3"><h3 className="font-semibold">{donation.food_type}</h3><DonationStatusBadge status={donation.status} /></div><p className="mt-3 text-sm text-muted">{donation.meal_portions} portions · {donation.location}</p><p className="mt-2 text-xs text-muted">Collection deadline: {formatDashboardDate(donation.collection_deadline)}</p></Link>)}</DashboardSection></>}
  </DashboardView>
}
