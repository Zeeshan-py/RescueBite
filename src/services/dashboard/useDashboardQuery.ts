import { useCallback, useEffect, useState } from 'react'
import { useNotifications } from '../notifications/useNotifications'

// Reuse the existing notification subscription; no extra table channels.
// Focus and manual refresh also cover administrative changes without notifications.
export function useDashboardQuery<T>(load: () => Promise<T>) {
  const { notifications } = useNotifications()
  const newestNotification = notifications[0]?.id
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      void load().then((result) => { if (active) setData(result) })
        .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Dashboard unavailable.') })
        .finally(() => { if (active) setLoading(false) })
    }, 80)
    return () => { active = false; window.clearTimeout(timer) }
  }, [load, newestNotification, revision])
  useEffect(() => {
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])
  return { data, loading, error, refresh }
}
