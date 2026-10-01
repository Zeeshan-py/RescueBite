import { createContext } from 'react'
import type { Notification } from '../../types/domain'

export interface NotificationContextValue {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  error: string | null
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  refresh: () => Promise<void>
}

export const NotificationContext = createContext<NotificationContextValue | null>(null)
