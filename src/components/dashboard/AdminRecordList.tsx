import type { AdminRow, AdminView } from '../../services/dashboard/dashboard.types'
import { formatAdminValue } from '../../services/dashboard/dashboard.utils'
import { EmptyState } from '../common/EmptyState'
import { StatusBadge } from '../common/StatusBadge'
import type { DonationStatus, PickupTaskStatus } from '../../types/domain'
import { Fragment, useId, useRef, useState } from 'react'
import { Icon, type IconName } from '../common/Icon'

const fields: Record<AdminView, Array<[string, string]>> = {
  users: [['email', 'Email'], ['role', 'Role'], ['account_status','Account status'], ['created_at', 'Profile created']],
  donations: [['donor_name', 'Donor'], ['quantity', 'Quantity'], ['meal_portions', 'Portions'], ['location', 'Pickup location'], ['status', 'Donation status'], ['organization_name', 'Receiving NGO'], ['pickup_status', 'Legacy pickup status'], ['collection_deadline', 'Collection deadline'], ['created_at', 'Created']],
  ngos: [['user_name', 'Associated user'], ['verification_status','Verification'], ['registration_reference','Registration reference'], ['service_area','Service area'], ['accepted_food_types', 'Accepted food types'], ['capacity', 'Capacity (portions)'], ['location', 'Location'], ['has_coordinates', 'Map position'], ['accepted_count', 'Accepted donations'], ['created_at', 'Created']],
  recipients: [['request_count','Requests'],['active_count','Accepted'],['completed_count','Completed'],['account_status','Account status'],['created_at','Joined']],
  activity: [['actor_name', 'Actor'], ['entity_type', 'Entity type'], ['entity_id', 'Related record'], ['details','Moderation reason'], ['created_at', 'Occurred']],
}
const titleField: Record<AdminView, string> = { users: 'name', donations: 'food_type', ngos: 'organization_name', recipients: 'name', activity: 'action' }
const columns: Record<AdminView, string[]> = {
  users: ['email', 'role', 'created_at'], donations: ['donor_name', 'meal_portions', 'status', 'collection_deadline'],
  ngos: ['verification_status', 'capacity', 'accepted_count'], recipients: ['request_count','active_count','completed_count'],
  activity: ['actor_name', 'entity_type', 'created_at'],
}
const icons: Record<AdminView, IconName> = { users: 'user', donations: 'box', ngos: 'building', recipients: 'user', activity: 'activity' }
const titles: Record<AdminView, string> = { users: 'Member', donations: 'Donation', ngos: 'Organization', recipients: 'Recipient', activity: 'Event' }
const detailGroups: Record<AdminView, Array<{ title: string; icon: IconName; keys: string[] }>> = {
  donations: [
    { title: 'Food & donor', icon: 'box', keys: ['donor_name', 'quantity', 'meal_portions'] },
    { title: 'Pickup & timing', icon: 'location', keys: ['location', 'collection_deadline', 'created_at'] },
    { title: 'Redistribution', icon: 'truck', keys: ['status', 'organization_name', 'pickup_status'] },
  ],
  users: [
    { title: 'Contact', icon: 'user', keys: ['email'] },
    { title: 'Account', icon: 'shield', keys: ['role', 'account_status', 'created_at'] },
  ],
  ngos: [
    { title: 'Organization', icon: 'building', keys: ['user_name', 'verification_status', 'registration_reference', 'created_at'] },
    { title: 'Receiving capacity', icon: 'box', keys: ['capacity', 'accepted_food_types', 'accepted_count'] },
    { title: 'Service area', icon: 'location', keys: ['location', 'service_area', 'has_coordinates'] },
  ],
  recipients: [
    { title: 'Requests', icon: 'box', keys: ['request_count', 'active_count', 'completed_count'] },
    { title: 'Account', icon: 'user', keys: ['account_status', 'created_at'] },
  ],
  activity: [
    { title: 'Who & when', icon: 'clock', keys: ['actor_name', 'created_at'] },
    { title: 'Related record', icon: 'activity', keys: ['entity_type', 'entity_id'] },
    { title: 'Review', icon: 'shield', keys: ['details'] },
  ],
}

function detailValue(row: AdminRow, field: string) {
  const value = row[field]
  if (value === null || value === undefined || value === '') return <span className="record-missing">Not recorded</span>
  if (field === 'status' || field === 'pickup_status') return <StatusBadge status={String(value) as DonationStatus | PickupTaskStatus} />
  if (field.endsWith('_at') || field === 'collection_deadline') {
    const date = new Date(String(value))
    return <time dateTime={String(value)}><span>{date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span><small>{date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</small></time>
  }
  if (typeof value === 'number') return value.toLocaleString()
  if (Array.isArray(value) && value.length) return <span className="record-detail-tags">{value.map(item => <span key={item}>{item}</span>)}</span>
  return formatAdminValue(row, field)
}

export function AdminRecordList({ view, rows, onModerate }: { view: AdminView; rows: AdminRow[]; onModerate?: (row: AdminRow, decision: string, reason: string) => Promise<void> }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [reason, setReason] = useState(''), [decision, setDecision] = useState(''), [busy, setBusy] = useState(false), [actionError, setActionError] = useState<string | null>(null)
  const scrollRegion = useRef<HTMLDivElement>(null)
  const idPrefix = useId()
  if (!rows.length) return <EmptyState title="No records to display." />
  async function moderate(row: AdminRow) {
    if (!onModerate || !decision) return
    setBusy(true); setActionError(null)
    try { await onModerate(row, decision, reason); setDecision(''); setReason('') }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Moderation failed.') }
    finally { setBusy(false) }
  }
  function cell(row: AdminRow, field: string) {
    return (field === 'status' || field === 'pickup_status') && row[field]
      ? <StatusBadge status={String(row[field]) as DonationStatus | PickupTaskStatus} /> : formatAdminValue(row, field)
  }
  return <div ref={scrollRegion} className="table-scroll" role="region" aria-label={`${titles[view]} records`} tabIndex={0}><table className="records-table"><caption className="sr-only">{titles[view]} records. Expand a row to view all details.</caption><thead><tr><th scope="col">{titles[view]}</th>{columns[view].map(field => <th key={field} scope="col">{fields[view].find(([key]) => key === field)?.[1]}</th>)}<th scope="col"><span className="sr-only">Details</span></th></tr></thead><tbody>{rows.map(row => {
    const id = String(row.id), open = expanded === id, title = formatAdminValue(row, titleField[view])
    const detailId = `${idPrefix}-record-${id}`
    return <Fragment key={id}>
      <tr className={open ? 'record-row-open' : undefined}><th scope="row"><div className="record-title"><span className="record-symbol"><Icon name={icons[view]} width="18" /></span><span>{title}</span></div></th>{columns[view].map(field => <td key={field}><div className={field === 'location' || field === 'email' ? 'cell-truncate' : undefined} title={formatAdminValue(row, field)}>{cell(row, field)}</div></td>)}<td><button id={`${detailId}-toggle`} type="button" className="record-expand" aria-label={`${open ? 'Hide' : 'Show'} details for ${title}`} aria-expanded={open} aria-controls={open ? detailId : undefined} onClick={() => { setExpanded(open ? null : id); if (!open) scrollRegion.current?.scrollTo({ left: 0 }) }}><span>{open ? 'Close' : 'Details'}</span><Icon name="chevron" width="16" /></button></td></tr>
      {open && <tr id={detailId} className="record-expanded"><td colSpan={columns[view].length + 2}>
        <div className="record-details" role="region" aria-labelledby={`${detailId}-title`}>
          <div className="record-details-header"><span className="record-symbol"><Icon name={icons[view]} width="22" /></span><div><p>{titles[view]} details</p><h3 id={`${detailId}-title`}>{title}</h3></div><button type="button" className="record-detail-close" aria-label={`Close details for ${title}`} onClick={() => { setExpanded(null); document.getElementById(`${detailId}-toggle`)?.focus() }}><Icon name="close" width="18" /></button></div>
          <div className="record-detail-groups">{detailGroups[view].map(group => <section className="record-detail-group" key={group.title}>
            <h4><Icon name={group.icon} width="18" />{group.title}</h4>
            <dl>{group.keys.map(field => <div key={field}><dt>{fields[view].find(([key]) => key === field)?.[1]}</dt><dd>{detailValue(row, field)}</dd></div>)}</dl>
          </section>)}</div>
          {onModerate && ['users','recipients','ngos','donations'].includes(view) && <form className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4" onSubmit={(event) => { event.preventDefault(); void moderate(row) }}>
            <label className="min-w-44 flex-1 text-sm font-medium">Moderation action<select required value={decision} onChange={(event) => setDecision(event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-white p-3"><option value="">Select action</option>{view === 'ngos' ? <><option value="VERIFIED">Verify NGO</option><option value="REJECTED">Reject NGO</option></> : view === 'donations' ? <option value="CANCEL">Cancel donation</option> : <><option value="RESTRICTED">Restrict account</option><option value="ACTIVE">Restore account</option></>}</select></label>
            <label className="min-w-60 flex-[2] text-sm font-medium">Reason<input required minLength={10} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-white p-3" placeholder="Record at least 10 characters for the audit log" /></label>
            <button disabled={busy} className="min-h-11 rounded-lg bg-forest px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Apply action'}</button>
            {actionError && <p role="alert" className="w-full text-sm text-red-800">{actionError}</p>}
          </form>}
        </div>
      </td></tr>}
    </Fragment>
  })}</tbody></table></div>
}

export function ActivityFeed({ rows }: { rows: AdminRow[] }) {
  return <ol className="surface activity-feed">{rows.map(row => <li key={String(row.id)}><span className="activity-icon"><Icon name="activity" width="15" /></span><div><strong>{formatAdminValue(row, 'action')}</strong><p>{formatAdminValue(row, 'actor_name')} · {formatAdminValue(row, 'entity_type').toLowerCase()}</p></div><time dateTime={String(row.created_at)}>{formatAdminValue(row, 'created_at')}</time></li>)}</ol>
}
