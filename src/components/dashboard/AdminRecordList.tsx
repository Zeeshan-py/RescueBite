import type { AdminRow, AdminView } from '../../services/dashboard/dashboard.types'
import { formatAdminValue } from '../../services/dashboard/dashboard.utils'
import { EmptyState } from '../common/EmptyState'
import { StatusBadge } from '../common/StatusBadge'
import type { DonationStatus, PickupTaskStatus } from '../../types/domain'
import { Fragment, useState } from 'react'
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

export function AdminRecordList({ view, rows }: { view: AdminView; rows: AdminRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  if (!rows.length) return <EmptyState title="No records to display." />
  function cell(row: AdminRow, field: string) {
    return (field === 'status' || field === 'pickup_status') && row[field]
      ? <StatusBadge status={String(row[field]) as DonationStatus | PickupTaskStatus} /> : formatAdminValue(row, field)
  }
  return <div className="table-scroll" role="region" aria-label={`${titles[view]} records`} tabIndex={0}><table className="records-table"><caption className="sr-only">{titles[view]} records. Expand a row to view all details.</caption><thead><tr><th scope="col">{titles[view]}</th>{columns[view].map(field => <th key={field} scope="col">{fields[view].find(([key]) => key === field)?.[1]}</th>)}<th scope="col"><span className="sr-only">Details</span></th></tr></thead><tbody>{rows.map(row => {
    const id = String(row.id), open = expanded === id, title = formatAdminValue(row, titleField[view])
    return <Fragment key={id}><tr><th scope="row"><div className="record-title"><span className="record-symbol"><Icon name={icons[view]} width="16" /></span><span>{title}</span></div></th>{columns[view].map(field => <td key={field}><div className={field === 'location' || field === 'email' ? 'cell-truncate' : undefined} title={formatAdminValue(row, field)}>{cell(row, field)}</div></td>)}<td><button className="record-expand" aria-label={`${open ? 'Hide' : 'Show'} details for ${title}`} aria-expanded={open} aria-controls={`record-${id}`} onClick={() => setExpanded(open ? null : id)}><Icon name="chevron" width="16" /></button></td></tr>
      {open && <tr id={`record-${id}`} className="record-expanded"><td colSpan={columns[view].length + 2}><dl>{fields[view].map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{cell(row, field)}</dd></div>)}</dl></td></tr>}</Fragment>
  })}</tbody></table></div>
}

export function ActivityFeed({ rows }: { rows: AdminRow[] }) {
  return <ol className="surface activity-feed">{rows.map(row => <li key={String(row.id)}><span className="activity-icon"><Icon name="activity" width="15" /></span><div><strong>{formatAdminValue(row, 'action')}</strong><p>{formatAdminValue(row, 'actor_name')} · {formatAdminValue(row, 'entity_type').toLowerCase()}</p></div><time dateTime={String(row.created_at)}>{formatAdminValue(row, 'created_at')}</time></li>)}</ol>
}
