import { Link } from 'react-router-dom'
import { DashboardSection, DashboardView, SummaryCards } from '../../components/dashboard/DashboardView'
import { AdminRecordList } from '../../components/dashboard/AdminRecordList'
import { getAdminDashboard } from '../../services/dashboard/dashboard.service'
import { donationStatuses } from '../../services/dashboard/dashboard.utils'
import { useDashboardQuery } from '../../services/dashboard/useDashboardQuery'

export default function AdminDashboardPage() {
  const query = useDashboardQuery(getAdminDashboard)
  return <DashboardView title="Platform overview" description="Monitor users and food rescues. Operational records are read-only; workflow actions remain with the authorized participants." {...query}>
    {query.data && <><SummaryCards summary={query.data.summary} /><div className="mt-6 flex flex-wrap gap-3">{[['Users', 'users'], ['Donations', 'donations'], ['NGOs', 'ngos'], ['Volunteers', 'volunteers'], ['Activity', 'activity']].map(([label, path]) => <Link key={path} to={`/admin/${path}`} className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-forest">{label} →</Link>)}</div>
      <DashboardSection title="Donation workflow"><dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{donationStatuses.map((status) => <div key={status} className="flex justify-between gap-3 rounded-lg border border-line bg-white p-4 text-sm"><dt>{status.replaceAll('_', ' ')}</dt><dd className="font-semibold text-forest">{query.data!.summary.statuses[status] ?? 0}</dd></div>)}</dl></DashboardSection>
      <DashboardSection title="Recent donations"><AdminRecordList view="donations" rows={query.data.donations.rows} /></DashboardSection>
      <DashboardSection title="Recent activity"><AdminRecordList view="activity" rows={query.data.activity.rows} /></DashboardSection></>}
  </DashboardView>
}
