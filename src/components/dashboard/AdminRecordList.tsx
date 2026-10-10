import type { AdminRow, AdminView } from '../../services/dashboard/dashboard.types'
import { formatAdminValue } from '../../services/dashboard/dashboard.utils'
import { EmptyState } from '../common/EmptyState'
import { StatusBadge } from '../common/StatusBadge'
import type { DonationStatus, PickupTaskStatus } from '../../types/domain'
import { Fragment, useId, useRef, useState } from 'react'
import { Icon, type IconName } from '../common/Icon'

const fields: Record<AdminView, Array<[string, string]>> = {
  users: [['email', 'Email'], ['role', 'Role'], ['created_at', 'Profile created']],
  donations: [['donor_name', 'Donor'], ['quantity', 'Quantity'], ['meal_portions', 'Portions'], ['location', 'Pickup location'], ['status', 'Donation status'], ['organization_name', 'Receiving NGO'], ['pickup_status', 'Pickup status'], ['collection_deadline', 'Collection deadline'], ['created_at', 'Created']],
  ngos: [['user_name', 'Associated user'], ['accepted_food_types', 'Accepted food types'], ['capacity', 'Capacity (portions)'], ['location', 'Location'], ['has_coordinates', 'Map position'], ['accepted_count', 'Accepted donations'], ['created_at', 'Created']],
  volunteers: [['pickup_count', 'Pickup count'], ['active_count', 'Active assignments'], ['collected_count', 'Collected pickups'], ['delivered_count', 'Delivered pickups'], ['created_at', 'Profile created']],
  activity: [['actor_name', 'Actor'], ['entity_type', 'Entity type'], ['entity_id', 'Related record'], ['created_at', 'Occurred']],
}
const titleField: Record<AdminView, string> = { users: 'name', donations: 'food_type', ngos: 'organization_name', volunteers: 'name', activity: 'action' }
const columns: Record<AdminView, string[]> = {
  users: ['email', 'role', 'created_at'], donations: ['donor_name', 'meal_portions', 'status', 'collection_deadline'],
  ngos: ['capacity', 'accepted_count', 'location'], volunteers: ['active_count', 'delivered_count', 'pickup_count'],
  activity: ['actor_name', 'entity_type', 'created_at'],
}
const icons: Record<AdminView, IconName> = { users: 'user', donations: 'box', ngos: 'building', volunteers: 'truck', activity: 'activity' }
const titles: Record<AdminView, string> = { users: 'Member', donations: 'Donation', ngos: 'Organization', volunteers: 'Volunteer', activity: 'Event' }
const detailGroups: Record<AdminView, Array<{ title: string; icon: IconName; keys: string[] }>> = {
  donations: [
    { title: 'Food & donor', icon: 'box', keys: ['donor_name', 'quantity', 'meal_portions'] },
    { title: 'Pickup & timing', icon: 'location', keys: ['location', 'collection_deadline', 'created_at'] },
    { title: 'Redistribution', icon: 'truck', keys: ['status', 'organization_name', 'pickup_status'] },
  ],
  users: [
    { title: 'Contact', icon: 'user', keys: ['email'] },
    { title: 'Account', icon: 'shield', keys: ['role', 'created_at'] },
  ],
  ngos: [
    { title: 'Organization', icon: 'building', keys: ['user_name', 'created_at'] },
    { title: 'Receiving capacity', icon: 'box', keys: ['capacity', 'accepted_food_types', 'accepted_count'] },
    { title: 'Location', icon: 'location', keys: ['location', 'has_coordinates'] },
  ],
  volunteers: [
    { title: 'Assignments', icon: 'truck', keys: ['pickup_count', 'active_count'] },
    { title: 'Rescue progress', icon: 'check', keys: ['collected_count', 'delivered_count'] },
    { title: 'Account', icon: 'user', keys: ['created_at'] },
  ],
  activity: [
    { title: 'Who & when', icon: 'clock', keys: ['actor_name', 'created_at'] },
    { title: 'Related record', icon: 'activity', keys: ['entity_type', 'entity_id'] },
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

export function AdminRecordList({ view, rows }: { view: AdminView; rows: AdminRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const scrollRegion = useRef<HTMLDivElement>(null)
  const idPrefix = useId()
  if (!rows.length) return <EmptyState title="No records to display." />
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
        </div>
      </td></tr>}
    </Fragment>
  })}</tbody></table></div>
}

export function ActivityFeed({ rows }: { rows: AdminRow[] }) {
  return <ol className="surface activity-feed">{rows.map(row => <li key={String(row.id)}><span className="activity-icon"><Icon name="activity" width="15" /></span><div><strong>{formatAdminValue(row, 'action')}</strong><p>{formatAdminValue(row, 'actor_name')} · {formatAdminValue(row, 'entity_type').toLowerCase()}</p></div><time dateTime={String(row.created_at)}>{formatAdminValue(row, 'created_at')}</time></li>)}</ol>
}
