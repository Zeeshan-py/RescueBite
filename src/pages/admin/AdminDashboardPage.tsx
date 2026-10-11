import { Link } from 'react-router-dom'
import { DashboardSection, DashboardView, SummaryCards } from '../../components/dashboard/DashboardView'
import { ActivityFeed, AdminRecordList } from '../../components/dashboard/AdminRecordList'
import { getAdminDashboard } from '../../services/dashboard/dashboard.service'
import { OutcomeChart, StatusBars } from '../../components/analytics/AnalyticsCharts'
import { Icon } from '../../components/common/Icon'
import { useDashboardQuery } from '../../services/dashboard/useDashboardQuery'
import { EmptyState } from '../../components/common/EmptyState'

export default function AdminDashboardPage() {
  const query = useDashboardQuery(getAdminDashboard)
  return <DashboardView mobileTitle="Overview" eyebrow="NETWORK OVERVIEW" title="Every rescue, connected." actions={<Link to="/admin/analytics" className="button-primary"><Icon name="chart" width="17" />View impact report</Link>} {...query}>
    {query.data && <><SummaryCards summary={query.data.summary} /><div className="quick-links">{[['Users', 'users'], ['Donations', 'donations'], ['NGOs', 'ngos'], ['Recipients', 'recipients'], ['Activity', 'activity']].map(([label, path]) => <Link key={path} to={`/admin/${path}`}>{label}<Icon name="arrow" width="14" /></Link>)}</div>
      {query.data.summary.counts.total_donations ? <div className="admin-chart-grid"><OutcomeChart statuses={query.data.summary.statuses} /><section className="surface"><div className="panel-heading"><div><p className="eyebrow">OPERATIONS SNAPSHOT</p><h2>Where rescues stand</h2></div><Icon name="activity" /></div><StatusBars statuses={query.data.summary.statuses} /></section></div> : <div className="mt-8"><EmptyState title="No donations have been posted yet." /></div>}
      {query.data.donations.rows.length > 0 && <DashboardSection title="Recent donations"><AdminRecordList view="donations" rows={query.data.donations.rows} /></DashboardSection>}
      {query.data.activity.rows.length > 0 && <DashboardSection title="Recent activity"><ActivityFeed rows={query.data.activity.rows} /></DashboardSection>}</>}
  </DashboardView>
}
