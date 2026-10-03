import { beforeEach, describe, expect, it, vi } from 'vitest'

const { query, client } = vi.hoisted(() => {
  const result = { data: [], error: null, count: 0 }
  const query = { select: vi.fn(), update: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) }
  for (const method of ['select', 'update', 'eq', 'order', 'limit'] as const) query[method].mockImplementation(() => query)
  const client = { from: vi.fn(() => query), auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'current-admin' } }, error: null })) } }
  return { query, client }
})
vi.mock('../../lib/supabase', () => ({ getSupabaseClient: () => client }))
import { getMyNotifications, getUnreadNotificationCount, getUnreadNotifications, markAllNotificationsAsRead, markNotificationAsRead } from './notification.service'

describe('personal notifications with administrator RLS', () => {
  beforeEach(() => vi.clearAllMocks())
  it.each([
    ['list', () => getMyNotifications()], ['unread list', () => getUnreadNotifications()],
    ['unread count', () => getUnreadNotificationCount()], ['mark one', () => markNotificationAsRead('notification-id')],
    ['mark all', () => markAllNotificationsAsRead()],
  ] as const)('scopes %s to the authenticated account', async (_name, run) => {
    await run()
    expect(query.eq).toHaveBeenCalledWith('user_id', 'current-admin')
  })
  it.each([[-1, 1], [1000000, 100], [NaN, 50], [2.8, 2]])('bounds requested history %s to %s', async (input, expected) => {
    await getMyNotifications(input)
    expect(query.limit).toHaveBeenCalledWith(expected)
  })
  it('does not expose raw backend details', async () => {
    client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'current-admin' } }, error: { message: 'SQL secret table internal stack' } } as never)
    await expect(getMyNotifications()).rejects.toThrow('Notifications could not be updated or loaded.')
  })
})
