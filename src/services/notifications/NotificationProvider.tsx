import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import type { Notification } from '../../types/domain'
import { NotificationContext } from './notification-context'
import { getMyNotifications, markAllNotificationsAsRead, markNotificationAsRead, subscribeToMyNotifications, unsubscribeFromNotifications } from './notification.service'
import { mergeNotifications, unreadNotificationCount } from './notification.utils'

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const records = await getMyNotifications()
      setNotifications((current) => mergeNotifications(current, records))
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Notifications could not be loaded.')
    } finally { setIsLoading(false) }
  }, [user])

  useEffect(() => {
    if (!user) return
    const channel = subscribeToMyNotifications(user.id, (record) => {
      setNotifications((current) => mergeNotifications(current, [record]))
    }, (status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError('Live notification updates are reconnecting.')
      if (status === 'SUBSCRIBED') setError(null)
    })
    const initialLoad = window.setTimeout(() => { void refresh() }, 0)
    return () => { window.clearTimeout(initialLoad); void unsubscribeFromNotifications(channel) }
  }, [refresh, user])

  const markRead = useCallback(async (id: string) => {
    await markNotificationAsRead(id)
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item))
  }, [])

  const markAllRead = useCallback(async () => {
    await markAllNotificationsAsRead()
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })))
  }, [])

  const value = useMemo(() => ({ notifications, unreadCount: unreadNotificationCount(notifications), isLoading, error, markRead, markAllRead, refresh }), [error, isLoading, markAllRead, markRead, notifications, refresh])
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}
