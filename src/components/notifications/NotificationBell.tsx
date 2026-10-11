import { LoadingState } from '../common/LoadingState'
import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useNotifications } from '../../services/notifications/useNotifications'
import { NotificationList } from './NotificationList'

export function NotificationBell() {
  const { notifications, unreadCount, isLoading, error, markRead, markAllRead } = useNotifications()
  const panel = useRef<HTMLDetailsElement>(null)
  const [marking, setMarking] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const close = () => { panel.current?.removeAttribute('open'); panel.current?.querySelector('summary')?.focus() }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && panel.current?.open) close() }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [])
  async function markAll() { setMarking(true); setActionError(null); try { await markAllRead() } catch { setActionError('The updates could not be saved. Check your connection and try again.') } finally { setMarking(false) } }
  return <details ref={panel} className="group relative">
    <summary className="notification-toggle relative grid size-11 list-none place-items-center rounded-full border border-line bg-white text-ink hover:bg-canvas" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
      {unreadCount > 0 && <span className="notification-count absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-forest px-1 text-[10px] font-bold text-white" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </summary>
    <div className="notification-panel fixed inset-x-3 top-20 z-40 overflow-hidden rounded-2xl border border-line bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[390px]">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-4">
        <div><h2 className="font-display text-xl">Notifications</h2><p className="text-xs text-muted">{unreadCount} unread</p></div>
        <div className="flex items-center gap-3">{unreadCount > 0 && <button type="button" disabled={marking} onClick={() => void markAll()} className="min-h-11 text-xs font-semibold text-forest hover:underline disabled:opacity-60">{marking ? 'Updating…' : 'Mark all read'}</button>}<button type="button" onClick={close} aria-label="Close notifications" className="grid size-11 place-items-center rounded-lg border border-line text-xl">×</button></div>
      </div>
      <div className="max-h-[min(60vh,430px)] overflow-y-auto">
        {actionError && <p role="alert" className="p-4 text-sm text-red-800">{actionError}</p>}
        {isLoading ? <LoadingState compact label="Loading notifications…" /> : error && notifications.length === 0 ? <p role="alert" className="p-6 text-sm text-red-700">{error}</p> : <NotificationList notifications={notifications.slice(0, 8)} onMarkRead={markRead} compact />}
        {error && notifications.length > 0 && <p role="status" className="p-4 text-xs text-muted">{error}</p>}
      </div>
      <Link to="/notifications" onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')} className="block border-t border-line px-4 py-3 text-center text-sm font-semibold text-forest hover:bg-canvas">View all notifications</Link>
    </div>
  </details>
}
