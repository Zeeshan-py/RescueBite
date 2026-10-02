import type { AdminRow, AdminView } from '../../services/dashboard/dashboard.types'
import { formatAdminValue } from '../../services/dashboard/dashboard.utils'

const fields: Record<AdminView, Array<[string, string]>> = {
  users: [['email', 'Email'], ['role', 'Role'], ['created_at', 'Profile created']],
  donations: [['donor_name', 'Donor'], ['quantity', 'Quantity'], ['meal_portions', 'Portions'], ['location', 'Pickup location'], ['status', 'Donation status'], ['organization_name', 'Receiving NGO'], ['pickup_status', 'Pickup status'], ['collection_deadline', 'Collection deadline'], ['created_at', 'Created']],
  ngos: [['user_name', 'Associated user'], ['accepted_food_types', 'Accepted food types'], ['capacity', 'Capacity (portions)'], ['location', 'Location'], ['has_coordinates', 'Map position'], ['accepted_count', 'Accepted donations'], ['created_at', 'Created']],
  volunteers: [['pickup_count', 'Pickup count'], ['active_count', 'Active assignments'], ['collected_count', 'Collected pickups'], ['delivered_count', 'Delivered pickups'], ['created_at', 'Profile created']],
  activity: [['actor_name', 'Actor'], ['entity_type', 'Entity type'], ['entity_id', 'Related record'], ['created_at', 'Occurred']],
}
const titleField: Record<AdminView, string> = { users: 'name', donations: 'food_type', ngos: 'organization_name', volunteers: 'name', activity: 'action' }

export function AdminRecordList({ view, rows }: { view: AdminView; rows: AdminRow[] }) {
  if (!rows.length) return <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-muted">No records match these filters.</p>
  return <div className="grid gap-4">{rows.map((row) => <article key={String(row.id)} className="min-w-0 rounded-xl border border-line bg-white p-5 sm:p-6"><h3 className="break-words text-base font-semibold">{formatAdminValue(row, titleField[view])}</h3><dl className="mt-4 grid min-w-0 gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">{fields[view].map(([field, label]) => <div key={field} className="min-w-0"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words [overflow-wrap:anywhere]">{formatAdminValue(row, field)}</dd></div>)}</dl></article>)}</div>
}
