import { ErrorState } from '../../components/common/ErrorState'
import { LoadingState } from '../../components/common/LoadingState'
import { NotificationList } from '../../components/notifications/NotificationList'
import { useState } from 'react'
import { useNotifications } from '../../services/notifications/useNotifications'

export default function NotificationsPage() {
  const { notifications, unreadCount, isLoading, error, markRead, markAllRead, refresh } = useNotifications()
  const [marking, setMarking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  async function markAll() { setMarking(true); setActionError(null); try { await markAllRead() } catch { setActionError('The updates could not be saved. Check your connection and try again.') } finally { setMarking(false) } }
  return <div>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Your updates</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">Notifications</h1><p className="mt-3 text-sm text-muted">{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'No unread updates'}</p></div>
      {unreadCount > 0 && <button type="button" disabled={marking} onClick={() => void markAll()} className="button-secondary">{marking ? 'Updating…' : 'Mark all as read'}</button>}
    </div>
    <section aria-label="Notification history" className="mt-8 overflow-hidden rounded-2xl border border-line bg-white">
      {actionError && <p role="alert" className="p-5 text-sm text-red-800">{actionError}</p>}
      {isLoading ? <LoadingState label="Loading notification history…" /> : error && notifications.length === 0 ? <ErrorState title="Your updates couldn’t load." message={error} onRetry={() => void refresh()} /> : <NotificationList notifications={notifications} onMarkRead={markRead} />}
    </section>
    {error && notifications.length > 0 && <p role="status" className="mt-4 text-xs text-muted">{error}</p>}
  </div>
}
