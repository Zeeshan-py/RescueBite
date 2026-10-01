import { Link } from 'react-router-dom'
import { useNotifications } from '../../services/notifications/useNotifications'
import { NotificationList } from './NotificationList'

export function NotificationBell() {
  const { notifications, unreadCount, isLoading, error, markRead, markAllRead } = useNotifications()
  return <details className="group relative">
    <summary className="relative grid size-10 list-none place-items-center rounded-full border border-line bg-white text-ink hover:bg-canvas" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
      {unreadCount > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-forest px-1 text-[10px] font-bold text-white" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </summary>
    <div className="fixed inset-x-3 top-20 z-40 overflow-hidden rounded-2xl border border-line bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[390px]">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-4">
        <div><h2 className="font-display text-xl">Notifications</h2><p className="text-xs text-muted">{unreadCount} unread</p></div>
        {unreadCount > 0 && <button type="button" onClick={() => void markAllRead()} className="text-xs font-semibold text-forest hover:underline">Mark all read</button>}
      </div>
      <div className="max-h-[min(60vh,430px)] overflow-y-auto">
        {isLoading ? <p className="p-6 text-sm text-muted">Loading notifications…</p> : error && notifications.length === 0 ? <p role="alert" className="p-6 text-sm text-red-700">{error}</p> : <NotificationList notifications={notifications.slice(0, 8)} onMarkRead={markRead} compact />}
      </div>
      <Link to="/notifications" onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')} className="block border-t border-line px-4 py-3 text-center text-sm font-semibold text-forest hover:bg-canvas">View all notifications</Link>
    </div>
  </details>
}
