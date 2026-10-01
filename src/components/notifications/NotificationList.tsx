import type { Notification } from '../../types/domain'

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value))

export function NotificationList({
  notifications,
  onMarkRead,
  compact = false,
}: {
  notifications: Notification[]
  onMarkRead: (id: string) => Promise<void>
  compact?: boolean
}) {
  if (notifications.length === 0) return (
    <div className="px-5 py-10 text-center">
      <span aria-hidden="true" className="mx-auto grid size-11 place-items-center rounded-full bg-soft text-xl">✓</span>
      <p className="mt-3 text-sm font-semibold">You are all caught up</p>
      <p className="mt-1 text-xs text-muted">Workflow updates will appear here.</p>
    </div>
  )

  return <ul className="divide-y divide-line">
    {notifications.map((notification) => <li key={notification.id} className={`${notification.is_read ? 'bg-white' : 'bg-soft/55'} ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.is_read ? 'bg-line' : 'bg-forest'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">{notification.title}</h3>
            <time dateTime={notification.created_at} className="text-[11px] text-muted">{formatDate(notification.created_at)}</time>
          </div>
          <p className="mt-1 text-sm leading-5 text-muted">{notification.message}</p>
          {!notification.is_read && <button type="button" onClick={() => void onMarkRead(notification.id)} className="mt-3 text-xs font-semibold text-forest hover:underline">Mark as read</button>}
        </div>
      </div>
    </li>)}
  </ul>
}
