import { getSupabaseClient } from '../../lib/supabase'

export type RequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'COMPLETED'
export interface MealListing { id: string; food_type: string; meal_portions: number; quantity: number; public_area: string; available_from: string; collection_deadline: string; already_requested: boolean }
export interface FoodRequest { id: string; donation_id: string; status: RequestStatus; requested_portions: number; created_at: string; food_type: string; public_area: string; collection_deadline: string; donation_status: string; recipient_name: string }
export interface CollectionDetails { donation_id: string; recipient_id: string; collection_time: string | null; instructions: string; pickup_address: string; latitude: number | null; longitude: number | null; available_from: string; collection_deadline: string; donor_name: string; business_name: string | null; contact_phone: string | null; contact_email: string; pickup_hours: string | null; status: string; completed_at: string | null }
export interface RecipientProfile { user_id: string; general_area: string; preferred_contact: 'EMAIL' | 'PHONE'; latitude: number | null; longitude: number | null; daily_request_limit: number }

function fail(error: { message: string }): never { throw new Error(error.message || 'The request could not be completed.') }
export async function browseMeals(area = '', food = '', page = 1): Promise<{ rows: MealListing[]; total: number; page: number }> {
  const { data, error } = await getSupabaseClient().rpc('browse_available_meals', { area, food, page_number: page })
  if (error) fail(error)
  return data as { rows: MealListing[]; total: number; page: number }
}
export async function myFoodRequests(donationId?: string): Promise<FoodRequest[]> {
  const { data, error } = await getSupabaseClient().rpc('get_food_requests', { target_donation_id: donationId ?? null })
  if (error) fail(error)
  return data as FoodRequest[]
}
export async function requestFood(donationId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('request_food', { target_donation_id: donationId })
  if (error) fail(error)
}
export async function decideFoodRequest(requestId: string, decision: 'ACCEPT' | 'REJECT'): Promise<void> {
  const { error } = await getSupabaseClient().rpc('respond_to_food_request', { target_request_id: requestId, decision })
  if (error) fail(error)
}
export async function cancelFoodRequest(requestId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('cancel_food_request', { target_request_id: requestId })
  if (error) fail(error)
}
export async function getCollectionDetails(donationId: string): Promise<CollectionDetails> {
  const { data, error } = await getSupabaseClient().rpc('get_collection_details', { target_donation_id: donationId })
  if (error) fail(error)
  return data as CollectionDetails
}
export async function arrangeCollection(donationId: string, pickupAt: string, instructions: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('arrange_collection', { target_donation_id: donationId, pickup_at: new Date(pickupAt).toISOString(), collection_instructions: instructions })
  if (error) fail(error)
}
export async function getRecipientProfile(userId: string): Promise<RecipientProfile | null> {
  const { data, error } = await getSupabaseClient().from('recipient_profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) fail(error)
  return data as RecipientProfile | null
}
export async function saveRecipientProfile(userId: string, generalArea: string, preferredContact: 'EMAIL' | 'PHONE'): Promise<void> {
  const existing = await getRecipientProfile(userId)
  const client = getSupabaseClient()
  const result = existing ? await client.from('recipient_profiles').update({ general_area: generalArea.trim(), preferred_contact: preferredContact }).eq('user_id', userId)
    : await client.from('recipient_profiles').insert({ user_id: userId, general_area: generalArea.trim(), preferred_contact: preferredContact })
  if (result.error) fail(result.error)
}
