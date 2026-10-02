import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase'
import type { Notification } from '../../types/domain'

const selection = 'id,user_id,title,message,type,is_read,entity_type,entity_id,event_key,created_at'

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

async function myUserId(): Promise<string> {
  const { data, error } = await getSupabaseClient().auth.getUser()
  throwIfError(error)
  if (!data.user) throw new Error('Sign in to view your notifications.')
  return data.user.id
}

export async function getMyNotifications(limit = 50): Promise<Notification[]> {
  const { data, error } = await getSupabaseClient().from('notifications').select(selection)
    .eq('user_id', await myUserId()).order('created_at', { ascending: false }).limit(limit)
  throwIfError(error)
  return (data ?? []) as Notification[]
}

export async function getUnreadNotifications(): Promise<Notification[]> {
  const { data, error } = await getSupabaseClient().from('notifications').select(selection)
    .eq('user_id', await myUserId()).eq('is_read', false).order('created_at', { ascending: false })
  throwIfError(error)
  return (data ?? []) as Notification[]
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await getSupabaseClient().from('notifications')
    .select('id', { count: 'exact', head: true }).eq('user_id', await myUserId()).eq('is_read', false)
  throwIfError(error)
  return count ?? 0
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('notifications').update({ is_read: true }).eq('user_id', await myUserId()).eq('id', id)
  throwIfError(error)
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const { error } = await getSupabaseClient().from('notifications').update({ is_read: true }).eq('user_id', await myUserId()).eq('is_read', false)
  throwIfError(error)
}

export function subscribeToMyNotifications(
  userId: string,
  onInsert: (notification: Notification) => void,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  return getSupabaseClient().channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}`,
    }, (payload) => onInsert(payload.new as Notification))
    .subscribe((status) => onStatus?.(status))
}

export async function unsubscribeFromNotifications(channel: RealtimeChannel): Promise<void> {
  await getSupabaseClient().removeChannel(channel)
}
