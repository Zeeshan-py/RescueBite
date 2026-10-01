import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase'
import type { Donation, PickupTask } from '../../types/domain'

export function subscribeToDonationStatus(donationId: string, onChange: (donation: Donation) => void): RealtimeChannel {
  return getSupabaseClient().channel(`donation-status:${donationId}`)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'donations', filter: `id=eq.${donationId}`,
    }, (payload) => onChange(payload.new as Donation))
    .subscribe()
}

export function subscribeToPickupStatus(taskId: string, onChange: (task: PickupTask) => void): RealtimeChannel {
  return getSupabaseClient().channel(`pickup-status:${taskId}`)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'pickup_tasks', filter: `id=eq.${taskId}`,
    }, (payload) => onChange(payload.new as PickupTask))
    .subscribe()
}

export async function unsubscribeFromWorkflow(channel: RealtimeChannel): Promise<void> {
  await getSupabaseClient().removeChannel(channel)
}
