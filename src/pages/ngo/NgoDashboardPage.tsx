import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { DashboardSection, DashboardView, SummaryCards } from '../../components/dashboard/DashboardView'
import { NgoMatchCard } from '../../components/ngo/NgoMatchCard'
import { getNgoDashboard } from '../../services/dashboard/dashboard.service'
import { useDashboardQuery } from '../../services/dashboard/useDashboardQuery'

export default function NgoDashboardPage() {
  const { ngoProfile } = useAuth()
  const ngoId = ngoProfile?.id ?? null
  const load = useCallback(() => getNgoDashboard(ngoId), [ngoId])
  const query = useDashboardQuery(load)
  return <DashboardView title="NGO workspace" description={`Review matches and receiving progress for ${ngoProfile?.organization_name ?? 'your organization'}.`} {...query}>
    {query.data && <><SummaryCards summary={query.data.summary} />{!ngoProfile && <Link to="/ngo/setup" className="mt-6 block rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">Complete your organization profile →</Link>}
      <div className="mt-6 flex flex-wrap gap-3"><Link to="/ngo/donations" className="rounded-lg bg-pine px-5 py-3 text-sm font-semibold text-white">Review matches</Link><Link to="/ngo/accepted" className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-forest">View accepted donations</Link></div>
      <DashboardSection title="Pending decisions · earliest deadlines" empty={!query.data.pending.length ? 'No pending matches for your organization.' : undefined}>{query.data.pending.map((item) => <NgoMatchCard key={item.id} item={item} />)}</DashboardSection>
      <DashboardSection title="Recent accepted donations" empty={!query.data.accepted.length ? 'No accepted donations yet.' : undefined}>{query.data.accepted.map((item) => <NgoMatchCard key={item.id} item={item} />)}</DashboardSection>
      <DashboardSection title="Recent deliveries" empty={!query.data.deliveries.length ? 'No deliveries to confirm yet.' : undefined}>{query.data.deliveries.map((item) => <div key={item.id}><NgoMatchCard item={item} />{item.donation.status === 'DELIVERED' && <Link to={`/ngo/donations/${item.id}`} className="mt-2 inline-block text-sm font-semibold text-forest underline">Review and confirm receipt →</Link>}</div>)}</DashboardSection></>}
  </DashboardView>
}
