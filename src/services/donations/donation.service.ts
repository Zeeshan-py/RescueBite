import { getSupabaseClient } from '../../lib/supabase'
import type { Donation } from '../../types/domain'
import type { DonationInput } from './donation.types'
import { hasDonationErrors, resolvedFoodType, validateDonation } from './donation.validation'

export class DonationServiceError extends Error {
  constructor(message: string, public readonly code = 'DONATION_ERROR') {
    super(message)
    this.name = 'DonationServiceError'
  }
}

async function authenticatedUserId(): Promise<string> {
  const { data, error } = await getSupabaseClient().auth.getUser()
  if (error || !data.user) throw new DonationServiceError('Sign in again to manage donations.', 'UNAUTHENTICATED')
  return data.user.id
}

function values(input: DonationInput) {
  const errors = validateDonation(input)
  if (hasDonationErrors(errors)) throw new DonationServiceError('Review the highlighted donation information.', 'INVALID_DONATION')
  return {
    food_type: resolvedFoodType(input),
    quantity: input.quantity,
    meal_portions: input.mealPortions,
    location: input.location.trim(),
    available_from: new Date(input.availableFrom).toISOString(),
    collection_deadline: new Date(input.collectionDeadline).toISOString(),
    safety_information: input.safetyInformation.trim() || null,
    description: input.description.trim() || null,
  }
}

function friendlyFailure(action: string, error: { message: string; code?: string }): DonationServiceError {
  const message = error.message.toLowerCase()
  if (error.code === 'PGRST116') return new DonationServiceError('Donation not found or you do not have permission to view it.', 'NOT_FOUND')
  if (message.includes('fetch') || message.includes('network')) return new DonationServiceError('FoodBridge could not reach the server. Check your connection and try again.', 'NETWORK_ERROR')
  if (message.includes('donation can only') || message.includes('posted')) return new DonationServiceError('This donation can no longer be edited or cancelled.', 'INVALID_STATUS')
  return new DonationServiceError(`The donation could not be ${action}. Please try again.`)
}

export async function createDonation(input: DonationInput): Promise<Donation> {
  const donorId = await authenticatedUserId()
  const { data, error } = await getSupabaseClient().from('donations').insert({
    ...values(input), donor_id: donorId, status: 'POSTED',
  }).select('*').single()
  if (error) throw friendlyFailure('created', error)
  return data as Donation
}

export async function getMyDonations(): Promise<Donation[]> {
  const donorId = await authenticatedUserId()
  const { data, error } = await getSupabaseClient().from('donations').select('*')
    .eq('donor_id', donorId).order('created_at', { ascending: false })
  if (error) throw friendlyFailure('loaded', error)
  return data as Donation[]
}

export async function getDonationById(id: string): Promise<Donation> {
  await authenticatedUserId()
  const { data, error } = await getSupabaseClient().from('donations').select('*').eq('id', id).maybeSingle()
  if (error) throw friendlyFailure('loaded', error)
  if (!data) throw new DonationServiceError('Donation not found or you do not have permission to view it.', 'NOT_FOUND')
  return data as Donation
}

export async function updateDonation(id: string, input: DonationInput): Promise<Donation> {
  await authenticatedUserId()
  const { data, error } = await getSupabaseClient().from('donations').update(values(input))
    .eq('id', id).eq('status', 'POSTED').select('*').maybeSingle()
  if (error) throw friendlyFailure('updated', error)
  if (!data) throw new DonationServiceError('This donation can no longer be edited.', 'INVALID_STATUS')
  return data as Donation
}

export async function cancelDonation(id: string): Promise<Donation> {
  await authenticatedUserId()
  const { data, error } = await getSupabaseClient().rpc('cancel_my_donation', { target_donation_id: id })
  if (error) throw friendlyFailure('cancelled', error)
  if (!data) throw new DonationServiceError('This donation can no longer be cancelled.', 'INVALID_STATUS')
  return data as Donation
}
