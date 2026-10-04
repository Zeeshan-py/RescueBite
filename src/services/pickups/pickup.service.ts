import { getSupabaseClient } from '../../lib/supabase'
import type { PickupTask } from '../../types/domain'
import type { PickupTaskWithDonation } from './pickup.types'

export class PickupServiceError extends Error {
  constructor(message: string, public readonly code = 'PICKUP_ERROR') { super(message); this.name = 'PickupServiceError' }
}

function failure(error: { message: string }): PickupServiceError {
  const message = error.message.toLowerCase()
  if (message.includes('only volunteer') || message.includes('another volunteer') || message.includes('row-level security')) return new PickupServiceError('You do not have permission to perform this pickup action.', 'UNAUTHORIZED')
  if (message.includes('deadline')) return new PickupServiceError('This pickup can no longer be claimed because its collection deadline has passed.', 'EXPIRED')
  if (message.includes('no longer') || message.includes('only an assigned') || message.includes('not ready')) return new PickupServiceError('This pickup is no longer available for that action.', 'INVALID_STATUS')
  if (message.includes('fetch') || message.includes('network')) return new PickupServiceError('RescueBite could not reach the server. Check your connection and try again.', 'NETWORK_ERROR')
  return new PickupServiceError('The pickup workflow could not be completed. Please try again.')
}

export async function getPickupTasks(): Promise<PickupTaskWithDonation[]> {
  const { data, error } = await getSupabaseClient().from('pickup_tasks').select('*, donation:donations(*)').order('created_at', { ascending: false })
  if (error) throw failure(error)
  return data as unknown as PickupTaskWithDonation[]
}

export async function getPickupTask(id: string): Promise<PickupTaskWithDonation> {
  const { data, error } = await getSupabaseClient().from('pickup_tasks').select('*, donation:donations(*)').eq('id', id).maybeSingle()
  if (error) throw failure(error)
  if (!data) throw new PickupServiceError('Pickup task not found or you do not have permission to view it.', 'NOT_FOUND')
  return data as unknown as PickupTaskWithDonation
}

export async function getPickupForDonation(donationId: string): Promise<PickupTask | null> {
  const { data, error } = await getSupabaseClient().from('pickup_tasks').select('*').eq('donation_id', donationId).neq('status', 'CANCELLED').maybeSingle()
  if (error) throw failure(error)
  return data as PickupTask | null
}

async function runTaskRpc(name: 'claim_pickup_task' | 'mark_pickup_collected', taskId: string): Promise<PickupTaskWithDonation> {
  const { error } = await getSupabaseClient().rpc(name, { target_task_id: taskId })
  if (error) throw failure(error)
  return getPickupTask(taskId)
}

export const claimPickupTask = (taskId: string) => runTaskRpc('claim_pickup_task', taskId)
export const markPickupCollected = (taskId: string) => runTaskRpc('mark_pickup_collected', taskId)
