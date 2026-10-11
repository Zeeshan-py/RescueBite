import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { DashboardSection, DashboardView, SummaryCards } from '../../components/dashboard/DashboardView'
import { NgoMatchCard } from '../../components/ngo/NgoMatchCard'
import { getNgoDashboard } from '../../services/dashboard/dashboard.service'
import { useDashboardQuery } from '../../services/dashboard/useDashboardQuery'
import { EmptyState } from '../../components/common/EmptyState'
import { Icon } from '../../components/common/Icon'

export default function NgoDashboardPage() {
  const { ngoProfile } = useAuth()
  const ngoId = ngoProfile?.id ?? null
  const load = useCallback(() => getNgoDashboard(ngoId), [ngoId])
  const query = useDashboardQuery(load)
  return <DashboardView mobileTitle="NGO dashboard" eyebrow="ORGANIZATION OVERVIEW" title="Your community, supported." description={ngoProfile?.organization_name} actions={<Link to="/ngo/donations" className="button-primary"><Icon name="leaf" width="17" />Review matches</Link>} {...query}>
    {query.data && <><SummaryCards summary={query.data.summary} />{!ngoProfile && <Link to="/ngo/setup" className="mt-6 block rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">Complete your organization profile →</Link>}
      <div className="quick-links"><Link to="/ngo/analytics"><Icon name="chart" width="16" />View organization impact<Icon name="arrow" width="14" /></Link><Link to="/ngo/accepted">Accepted donations<Icon name="arrow" width="14" /></Link></div>
      {!query.data.pending.length && !query.data.accepted.length && !query.data.deliveries.length ? <div className="mt-8"><EmptyState title={ngoProfile ? 'No donations matched to your organization yet.' : 'Complete your organization profile to receive matches.'} /></div> : <>
        {query.data.pending.length > 0 && <DashboardSection title="Pending decisions · earliest deadlines"><div className="rescue-card-grid">{query.data.pending.map((item) => <NgoMatchCard key={item.id} item={item} />)}</div></DashboardSection>}
        {query.data.accepted.length > 0 && <DashboardSection title="Recent accepted donations"><div className="rescue-card-grid">{query.data.accepted.map((item) => <NgoMatchCard key={item.id} item={item} />)}</div></DashboardSection>}
        {query.data.deliveries.length > 0 && <DashboardSection title="Recent deliveries">{query.data.deliveries.map((item) => <div key={item.id}><NgoMatchCard item={item} />{item.donation.status === 'DELIVERED' && <Link to={`/ngo/donations/${item.id}`} className="mt-2 inline-block text-sm font-semibold text-forest underline">Review and confirm receipt →</Link>}</div>)}</DashboardSection>}</>}
      </>}
  </DashboardView>
}
