import { getSupabaseClient } from '../../lib/supabase'

export interface DonorBusinessProfile { user_id: string; business_name: string; business_type: 'RESTAURANT' | 'BAKERY' | 'CATERER' | 'GROCERY' | 'OTHER'; pickup_address: string; general_area: string; pickup_hours: string; description: string | null; latitude: number | null; longitude: number | null }
export interface ProfileVerification { phone_verified: boolean; email_verified: boolean; account_status: 'ACTIVE' | 'RESTRICTED'; daily_request_limit: number | null }
export async function getBusinessProfile(userId: string): Promise<DonorBusinessProfile | null> {
  const { data, error } = await getSupabaseClient().from('donor_profiles').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw Error(error.message)
  return data as DonorBusinessProfile | null
}
export async function saveBusinessProfile(profile: DonorBusinessProfile): Promise<void> {
  const current = await getBusinessProfile(profile.user_id)
  const client = getSupabaseClient()
  const values = { business_name: profile.business_name.trim(), business_type: profile.business_type, pickup_address: profile.pickup_address.trim(), general_area: profile.general_area.trim(), pickup_hours: profile.pickup_hours.trim(), description: profile.description?.trim() || null, latitude: profile.latitude, longitude: profile.longitude }
  const response = current ? await client.from('donor_profiles').update(values).eq('user_id', profile.user_id) : await client.from('donor_profiles').insert({ user_id: profile.user_id, ...values })
  if (response.error) throw Error(response.error.message)
}
export async function getProfileVerification(): Promise<ProfileVerification> {
  const { data, error } = await getSupabaseClient().rpc('get_profile_verification')
  if (error) throw Error(error.message)
  return data as ProfileVerification
}
export async function startPhoneVerification(phone: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.updateUser({ phone: phone.trim() })
  if (error) throw Error(error.message)
}
export async function confirmPhoneVerification(phone: string, token: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.verifyOtp({ phone: phone.trim(), token: token.trim(), type: 'phone_change' })
  if (error) throw Error(error.message)
}
