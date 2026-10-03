import type { Notification } from '../../types/domain'

export function mergeNotifications(current: Notification[], incoming: Notification[]): Notification[] {
  const records = new Map(current.map((item) => [item.id, item]))
  // Read actions are monotonic: a delayed INSERT/snapshot must not undo them.
  for (const item of incoming) records.set(item.id, { ...item, is_read: Boolean(records.get(item.id)?.is_read || item.is_read) })
  return [...records.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}

export function unreadNotificationCount(notifications: Notification[]): number {
  return notifications.reduce((count, item) => count + (item.is_read ? 0 : 1), 0)
}
