import { describe, expect, it } from 'vitest'
import type { Notification } from '../../types/domain'
import { mergeNotifications, unreadNotificationCount } from './notification.utils'

const record = (id: string, created_at: string, is_read = false): Notification => ({
  id, user_id: 'user-1', title: id, message: 'Message', type: 'MATCH_FOUND',
  is_read, entity_type: 'MATCH', entity_id: id, event_key: `event:${id}`, created_at,
})

describe('notification reconciliation', () => {
  it('deduplicates a realtime record also returned by the initial fetch', () => {
    const realtime = record('same', '2026-10-02T11:00:00Z')
    expect(mergeNotifications([realtime], [realtime])).toHaveLength(1)
  })

  it('uses the latest version and keeps newest records first', () => {
    const old = record('old', '2026-10-02T09:00:00Z')
    const updated = { ...old, is_read: true }
    const next = mergeNotifications([old], [record('new', '2026-10-02T12:00:00Z'), updated])
    expect(next.map((item) => item.id)).toEqual(['new', 'old'])
    expect(next[1]!.is_read).toBe(true)
  })

  it('counts only unread records', () => {
    expect(unreadNotificationCount([record('one', '2026-10-02T10:00:00Z'), record('two', '2026-10-02T09:00:00Z', true)])).toBe(1)
  })

  it('does not resurrect an unread badge from a delayed insert or stale fetch', () => {
    const read = record('same', '2026-10-02T11:00:00Z', true)
    expect(mergeNotifications([read], [{ ...read, is_read: false }])[0]!.is_read).toBe(true)
  })
})
