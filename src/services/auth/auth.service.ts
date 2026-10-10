import type { AuthError, Session, User as SupabaseUser } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase'
import type { NGO, User, UserRole } from '../../types/domain'
import type {
  NgoRegistrationDetails,
  ProfileUpdateInput,
  SignInResult,
  SignUpInput,
  SignUpResult,
} from './auth.types'
import { validateContactPhone } from './auth.validation'

const publicRoles: UserRole[] = ['DONOR', 'NGO', 'RECIPIENT']

export class AuthServiceError extends Error {
  constructor(message: string, public readonly code = 'AUTH_ERROR') {
    super(message)
    this.name = 'AuthServiceError'
  }
}
function friendlyAuthError(error: AuthError | Error): AuthServiceError {
  const message = error.message.toLowerCase()
  if (message.includes('invalid login credentials')) return new AuthServiceError('The email or password is incorrect.', 'INVALID_CREDENTIALS')
  if (message.includes('already registered') || message.includes('already exists')) return new AuthServiceError('An account already exists for this email.', 'EMAIL_EXISTS')
  if (message.includes('password')) return new AuthServiceError('The password does not meet the security requirements.', 'WEAK_PASSWORD')
  if (message.includes('email not confirmed')) return new AuthServiceError('Confirm your email before signing in.', 'EMAIL_NOT_CONFIRMED')
  if (message.includes('fetch') || message.includes('network')) return new AuthServiceError('Unable to reach the authentication service. Check your connection and try again.', 'NETWORK_ERROR')
  return new AuthServiceError('Authentication could not be completed. Please try again.')
}

function normalizeNgoMetadata(ngo?: NgoRegistrationDetails) {
  if (!ngo) return {}
  return {
    ngo_organization_name: ngo.organizationName.trim(),
    ngo_description: ngo.description.trim(),
    ngo_location: ngo.location.trim(),
    ngo_capacity: ngo.capacity,
    ngo_accepted_food_types: ngo.acceptedFoodTypes,
    ngo_contact_information: ngo.contactInformation.trim(),
  }
}

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        name: input.name.trim(),
        full_name: input.name.trim(),
        phone: input.phone.trim() || null,
        role: input.role,
        ...normalizeNgoMetadata(input.ngo),
      },
    },
  })

  if (error) throw friendlyAuthError(error)
  if (!data.user) throw new AuthServiceError('The account could not be created. Please try again.')
  if (data.user.identities?.length === 0) throw new AuthServiceError('An account already exists for this email.', 'EMAIL_EXISTS')

  return { user: data.user, session: data.session, requiresEmailConfirmation: !data.session }
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw friendlyAuthError(error)
  if (!data.session || !data.user) throw new AuthServiceError('A session could not be created. Please try again.')

  const profile = await ensureProfile(data.user)
  if (!profile) throw new AuthServiceError('Your account profile is not ready. Contact support if this continues.', 'PROFILE_MISSING')
  return { user: data.user, session: data.session, profile }
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut()
  if (error) throw friendlyAuthError(error)
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/google/callback` },
  })
  if (error) throw friendlyAuthError(error)
}

export async function completeGoogleProfile(authUser: SupabaseUser, role: UserRole): Promise<void> {
  if (!publicRoles.includes(role) || !authUser.email || !authUser.app_metadata.providers?.includes('google')) {
    throw new AuthServiceError('Choose a valid account role for your Google account.')
  }
  const name = String(authUser.user_metadata.name ?? authUser.user_metadata.full_name ?? '').trim() || authUser.email.split('@')[0]
  const { error } = await getSupabaseClient().rpc('complete_registration', { selected_role: role, display_name: name })
  // An existing profile is authoritative; never overwrite its role.
  if (error && error.code !== '23505') throw new AuthServiceError('Your profile could not be created. Please try again.')
}

export async function getCurrentUser(): Promise<SupabaseUser | null> {
  const { data, error } = await getSupabaseClient().auth.getUser()
  if (error) throw friendlyAuthError(error)
  return data.user
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.getSession()
  if (error) throw friendlyAuthError(error)
  return data.session
}

export async function getProfile(userId: string): Promise<User | null> {
  const { data, error } = await getSupabaseClient().from('users').select('*').eq('id', userId).abortSignal(AbortSignal.timeout(15000)).maybeSingle()
  if (error) throw new AuthServiceError('Your profile could not be loaded. Please try again.', 'PROFILE_LOAD_FAILED')
  return data as User | null
}

async function ensureProfile(authUser: SupabaseUser): Promise<User | null> {
  const existing = await getProfile(authUser.id)
  if (existing) return existing

  const role = String(authUser.user_metadata.role ?? '').toUpperCase() as UserRole
  const name = String(authUser.user_metadata.name ?? authUser.user_metadata.full_name ?? '').trim()
  if (!publicRoles.includes(role) || !name || !authUser.email) return null

  const { error } = await getSupabaseClient().rpc('complete_registration', { selected_role: role, display_name: name })
  if (error && error.code !== '23505') throw new AuthServiceError('Your profile could not be created. Please contact support.', 'PROFILE_CREATE_FAILED')
  return getProfile(authUser.id)
}

export async function loadProfile(authUser: SupabaseUser): Promise<User | null> {
  return ensureProfile(authUser)
}

export async function updateProfile(userId: string, input: ProfileUpdateInput): Promise<User> {
  const phoneError = validateContactPhone(input.phone ?? '')
  if (phoneError) throw new AuthServiceError(phoneError, 'INVALID_PHONE')
  const { data, error } = await getSupabaseClient()
    .from('users')
    .update({ name: input.name.trim(), phone: input.phone?.trim() || null, location: input.location?.trim() || null })
    .eq('id', userId)
    .select('*')
    .single()
  if (error) throw new AuthServiceError('Your profile could not be updated. Please try again.', 'PROFILE_UPDATE_FAILED')
  return data as User
}

export async function getNgoProfile(userId: string): Promise<NGO | null> {
  const { data, error } = await getSupabaseClient().from('ngos').select('*').eq('user_id', userId).abortSignal(AbortSignal.timeout(15000)).maybeSingle()
  if (error) throw new AuthServiceError('The NGO profile could not be loaded.', 'NGO_PROFILE_LOAD_FAILED')
  return data as NGO | null
}

export async function saveNgoProfile(userId: string, input: NgoRegistrationDetails): Promise<NGO> {
  const existing = await getNgoProfile(userId)
  const values = {
    organization_name: input.organizationName.trim(),
    description: input.description.trim() || null,
    location: input.location.trim(),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    capacity: input.capacity,
    accepted_food_types: input.acceptedFoodTypes,
    contact_information: input.contactInformation.trim() || null,
    service_area: input.serviceArea?.trim() || null,
    registration_reference: input.registrationReference?.trim() || null,
  }
  const query = existing
    ? getSupabaseClient().from('ngos').update(values).eq('user_id', userId)
    : getSupabaseClient().from('ngos').insert({ ...values, user_id: userId })
  const { data, error } = await query.select('*').single()
  if (error) throw new AuthServiceError('The NGO profile could not be saved. Review the fields and try again.', 'NGO_PROFILE_SAVE_FAILED')
  return data as NGO
}

export async function ensureNgoProfileFromMetadata(authUser: SupabaseUser): Promise<NGO | null> {
  const existing = await getNgoProfile(authUser.id)
  if (existing) return existing
  const metadata = authUser.user_metadata
  const organizationName = String(metadata.ngo_organization_name ?? '').trim()
  const location = String(metadata.ngo_location ?? '').trim()
  const acceptedFoodTypes = Array.isArray(metadata.ngo_accepted_food_types)
    ? metadata.ngo_accepted_food_types.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : []
  if (!organizationName || !location || !acceptedFoodTypes.length) return null
  return saveNgoProfile(authUser.id, {
    organizationName,
    description: String(metadata.ngo_description ?? ''),
    location,
    capacity: Math.max(0, Number(metadata.ngo_capacity) || 0),
    acceptedFoodTypes,
    contactInformation: String(metadata.ngo_contact_information ?? ''),
  })
}
