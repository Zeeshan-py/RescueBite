import { getSupabaseClient } from '../../lib/supabase'
import type { Donation, NGO, PickupTask } from '../../types/domain'
import { getPickupTask } from '../pickups/pickup.service'
import type { DeliveryStatus } from './delivery.types'

export class DeliveryServiceError extends Error {
  constructor(message: string, public readonly code = 'DELIVERY_ERROR') { super(message); this.name = 'DeliveryServiceError' }
}

function failure(error: { message: string }): DeliveryServiceError {
  const message = error.message.toLowerCase()
  if (message.includes('only ngo') || message.includes('only volunteer') || message.includes('another volunteer') || message.includes('not assigned') || message.includes('row-level security')) return new DeliveryServiceError('You do not have permission to perform this delivery action.', 'UNAUTHORIZED')
  if (message.includes('already') || message.includes('only a delivered') || message.includes('only a collected') || message.includes('not in collected')) return new DeliveryServiceError('This delivery action is no longer available in its current state.', 'INVALID_STATUS')
  if (message.includes('not found')) return new DeliveryServiceError('The delivery record could not be found.', 'NOT_FOUND')
  if (message.includes('fetch') || message.includes('network')) return new DeliveryServiceError('FoodBridge could not reach the server. Check your connection and try again.', 'NETWORK_ERROR')
  return new DeliveryServiceError('The delivery workflow could not be completed. Please try again.')
}

export async function getDeliveryStatus(donationId: string): Promise<DeliveryStatus> {
  const client = getSupabaseClient()
  const [pickupResult, matchResult] = await Promise.all([
    client.from('pickup_tasks').select('*').eq('donation_id', donationId).neq('status', 'CANCELLED').maybeSingle(),
    client.from('matches').select('ngo:ngos(id, organization_name, location, latitude, longitude)').eq('donation_id', donationId).eq('status', 'ACCEPTED').maybeSingle(),
  ])
  if (pickupResult.error) throw failure(pickupResult.error)
  if (matchResult.error) throw failure(matchResult.error)
  const match = matchResult.data as unknown as { ngo: Pick<NGO, 'id' | 'organization_name' | 'location' | 'latitude' | 'longitude'> | null } | null
  return { pickup: pickupResult.data as PickupTask | null, receivingNgo: match?.ngo ?? null }
}

export async function markDelivered(taskId: string) {
  const { error } = await getSupabaseClient().rpc('mark_pickup_delivered', { target_task_id: taskId })
  if (error) throw failure(error)
  return getPickupTask(taskId)
}

export async function confirmReceipt(donationId: string): Promise<Donation> {
  const client = getSupabaseClient()
  const { error } = await client.rpc('confirm_donation_receipt', { target_donation_id: donationId })
  if (error) throw failure(error)
  const refreshed = await client.from('donations').select('*').eq('id', donationId).single()
  if (refreshed.error) throw failure(refreshed.error)
  return refreshed.data as Donation
}

export async function getPickupDestination(donationId: string): Promise<DeliveryStatus['receivingNgo']> {
  const { data, error } = await getSupabaseClient().rpc('get_pickup_destination', { target_donation_id: donationId })
  if (error) throw failure(error)
  return data?.[0] ?? null
}
