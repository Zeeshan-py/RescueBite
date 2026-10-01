import { NotificationList } from '../../components/notifications/NotificationList'
import { useNotifications } from '../../services/notifications/useNotifications'

export default function NotificationsPage() {
  const { notifications, unreadCount, isLoading, error, markRead, markAllRead, refresh } = useNotifications()
  return <div>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Your updates</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">Notifications</h1><p className="mt-3 text-sm text-muted">{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'No unread updates'}</p></div>
      {unreadCount > 0 && <button type="button" onClick={() => void markAllRead()} className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-forest hover:bg-soft">Mark all as read</button>}
    </div>
    <section aria-label="Notification history" className="mt-8 overflow-hidden rounded-2xl border border-line bg-white">
      {isLoading ? <p className="p-8 text-sm text-muted">Loading notification history…</p> : error && notifications.length === 0 ? <div className="p-8"><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" onClick={() => void refresh()} className="mt-4 text-sm font-semibold text-forest hover:underline">Try again</button></div> : <NotificationList notifications={notifications} onMarkRead={markRead} />}
    </section>
    {error && notifications.length > 0 && <p role="status" className="mt-4 text-xs text-muted">{error}</p>}
  </div>
}
