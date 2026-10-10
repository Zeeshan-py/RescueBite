import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AdminRecordList } from '../../components/dashboard/AdminRecordList'
import { DashboardView } from '../../components/dashboard/DashboardView'
import { getAdminRecords } from '../../services/dashboard/dashboard.service'
import type { AdminFilters, AdminView } from '../../services/dashboard/dashboard.types'
import { adminQuery, donationStatuses, emptyAdminFilters } from '../../services/dashboard/dashboard.utils'
import { useDashboardQuery } from '../../services/dashboard/useDashboardQuery'
import { FOOD_TYPES } from '../../services/donations/donation.types'
import { Icon } from '../../components/common/Icon'

const titles: Record<AdminView, string> = { users: 'Users', donations: 'Donations', ngos: 'NGO organizations', volunteers: 'Volunteers', activity: 'Activity and audit' }
const inputClass = 'mt-1 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2.5 text-sm'

export default function AdminRecordsPage({ view }: { view: AdminView }) {
  const [draft, setDraft] = useState<AdminFilters>(emptyAdminFilters)
  const [filters, setFilters] = useState<AdminFilters>(emptyAdminFilters)
  const [page, setPage] = useState(1)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterToggle = useRef<HTMLButtonElement>(null)
  const restoreFilterFocus = useRef(false)
  const filterId = useId()
  const activeFilters = Object.values(filters).filter(Boolean).length
  const load = useCallback(() => getAdminRecords(view, filters, page), [view, filters, page])
  const query = useDashboardQuery(load)
  useEffect(() => {
    if (!query.loading && restoreFilterFocus.current) {
      if (filterToggle.current?.offsetParent) filterToggle.current.focus()
      restoreFilterFocus.current = false
    }
  }, [query.loading])
  function set(field: keyof AdminFilters, value: string) { setDraft((current) => ({ ...current, [field]: value })) }
  function apply(event: FormEvent) {
    event.preventDefault()
    try { adminQuery(view, draft, 1); restoreFilterFocus.current = true; setFilters({ ...draft }); setPage(1); setFilterError(null); setFiltersOpen(false); filterToggle.current?.focus() }
    catch (reason) { setFilterError(reason instanceof Error ? reason.message : 'Invalid filters.') }
  }
  return <><Link to="/admin" className="admin-overview-link mb-5 inline-block text-sm font-semibold text-forest">← Platform overview</Link><DashboardView title={titles[view]} description="Read-only operational records. Filters apply on the server; dates use UTC." {...query}>
    <div className="admin-filter-panel"><button ref={filterToggle} type="button" className="mobile-filter-toggle" aria-expanded={filtersOpen} aria-controls={filterId} onClick={() => setFiltersOpen(!filtersOpen)}><Icon name="filter" width="18" /><span>Filters</span>{activeFilters > 0 && <span className="active-filter-count">{activeFilters} active</span>}<Icon name="chevron" width="16" /></button>
    <form id={filterId} onSubmit={apply} className={`admin-filter-form mt-7 rounded-xl border border-line bg-white p-5${filtersOpen ? ' is-open' : ''}`}><div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <label className="min-w-0 text-xs font-semibold text-muted">Search<input className={inputClass} value={draft.search} maxLength={200} onChange={(event) => set('search', event.target.value)} placeholder={view === 'activity' ? 'Action, actor or entity ID' : 'Name or relevant text'} /></label>
      {view === 'users' && <label className="text-xs font-semibold text-muted">Role<select className={inputClass} value={draft.role} onChange={(event) => set('role', event.target.value)}><option value="">All roles</option>{['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'].map((role) => <option key={role}>{role}</option>)}</select></label>}
      {view === 'donations' && <><label className="text-xs font-semibold text-muted">Status<select className={inputClass} value={draft.status} onChange={(event) => set('status', event.target.value)}><option value="">All statuses</option>{donationStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-xs font-semibold text-muted">Food type<select className={inputClass} value={draft.food} onChange={(event) => set('food', event.target.value)}><option value="">All food types</option>{FOOD_TYPES.filter((food) => food !== 'Other').map((food) => <option key={food}>{food}</option>)}</select></label></>}
      {view === 'activity' && <><label className="text-xs font-semibold text-muted">Action<input className={inputClass} value={draft.action} onChange={(event) => set('action', event.target.value)} placeholder="Exact action, e.g. FOOD_COLLECTED" /></label><label className="text-xs font-semibold text-muted">Entity<select className={inputClass} value={draft.entity} onChange={(event) => set('entity', event.target.value)}><option value="">All entities</option>{['DONATION', 'MATCH', 'PICKUP_TASK', 'USER', 'NGO'].map((entity) => <option key={entity}>{entity}</option>)}</select></label></>}
      {(view === 'donations' || view === 'activity') && <><label className="text-xs font-semibold text-muted">From date (UTC)<input type="date" className={inputClass} value={draft.from} onChange={(event) => set('from', event.target.value)} /></label><label className="text-xs font-semibold text-muted">To date (UTC)<input type="date" className={inputClass} value={draft.to} onChange={(event) => set('to', event.target.value)} /></label></>}
    </div>{filterError && <p role="alert" className="mt-3 text-sm text-red-800">{filterError}</p>}<div className="mt-4 flex flex-wrap gap-3"><button className="rounded-lg bg-pine px-5 py-2.5 text-sm font-semibold text-white">Apply filters</button><button type="button" onClick={() => { restoreFilterFocus.current = true; setDraft(emptyAdminFilters); setFilters({ ...emptyAdminFilters }); setPage(1); setFilterError(null); setFiltersOpen(false); filterToggle.current?.focus() }} className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-muted">Reset</button></div></form></div>
    {query.data && <><p role="status" className="my-5 text-sm text-muted">{query.data.total} records · Page {page} of {Math.max(1, Math.ceil(query.data.total / query.data.page_size))}</p><AdminRecordList view={view} rows={query.data.rows} /><div className="mt-5 flex justify-between gap-3"><button disabled={page === 1 || query.loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-40">Previous</button><button disabled={page * query.data.page_size >= query.data.total || query.loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-40">Next</button></div></>}
  </DashboardView></>
}
