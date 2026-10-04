import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { DashboardSection, DashboardView, SummaryCards } from '../../components/dashboard/DashboardView'
import { NgoMatchCard } from '../../components/ngo/NgoMatchCard'
import { getNgoDashboard } from '../../services/dashboard/dashboard.service'
import { useDashboardQuery } from '../../services/dashboard/useDashboardQuery'
import { EmptyState } from '../../components/common/EmptyState'

export default function NgoDashboardPage() {
  const { ngoProfile } = useAuth()
  const ngoId = ngoProfile?.id ?? null
  const load = useCallback(() => getNgoDashboard(ngoId), [ngoId])
  const query = useDashboardQuery(load)
  return <DashboardView title="NGO workspace" description={`Review matches and receiving progress for ${ngoProfile?.organization_name ?? 'your organization'}.`} {...query}>
    {query.data && <><SummaryCards summary={query.data.summary} /><Link to="/ngo/analytics" className="mt-5 inline-block text-sm font-semibold text-forest underline">View my analytics and impact →</Link>{!ngoProfile && <Link to="/ngo/setup" className="mt-6 block rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">Complete your organization profile →</Link>}
      <div className="mt-6 flex flex-wrap gap-3"><Link to="/ngo/donations" className="rounded-lg bg-pine px-5 py-3 text-sm font-semibold text-white">Review matches</Link><Link to="/ngo/accepted" className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-forest">View accepted donations</Link></div>
      {!query.data.pending.length && !query.data.accepted.length && !query.data.deliveries.length ? <div className="mt-8"><EmptyState title={ngoProfile ? 'No donations matched to your organization yet.' : 'Complete your organization profile to receive matches.'} /></div> : <>
        {query.data.pending.length > 0 && <DashboardSection title="Pending decisions · earliest deadlines">{query.data.pending.map((item) => <NgoMatchCard key={item.id} item={item} />)}</DashboardSection>}
        {query.data.accepted.length > 0 && <DashboardSection title="Recent accepted donations">{query.data.accepted.map((item) => <NgoMatchCard key={item.id} item={item} />)}</DashboardSection>}
        {query.data.deliveries.length > 0 && <DashboardSection title="Recent deliveries">{query.data.deliveries.map((item) => <div key={item.id}><NgoMatchCard item={item} />{item.donation.status === 'DELIVERED' && <Link to={`/ngo/donations/${item.id}`} className="mt-2 inline-block text-sm font-semibold text-forest underline">Review and confirm receipt →</Link>}</div>)}</DashboardSection>}</>}
      </>}
  </DashboardView>
}
