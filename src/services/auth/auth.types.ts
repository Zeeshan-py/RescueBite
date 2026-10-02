import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import type { NGO, User, UserRole } from '../../types/domain'

export type PublicRegistrationRole = Exclude<UserRole, 'ADMIN'>

export interface NgoRegistrationDetails {
  organizationName: string
  description: string
  location: string
  latitude?: number | null
  longitude?: number | null
  capacity: number
  acceptedFoodTypes: string[]
  contactInformation: string
}

export interface SignUpInput {
  name: string
  email: string
  password: string
  phone: string
  role: PublicRegistrationRole
  ngo?: NgoRegistrationDetails
}

export interface SignUpResult {
  user: SupabaseUser
  session: Session | null
  requiresEmailConfirmation: boolean
}

export interface SignInResult {
  user: SupabaseUser
  session: Session
  profile: User
}

export interface ProfileUpdateInput {
  name: string
  phone: string | null
  location: string | null
}

export interface AuthSnapshot {
  user: SupabaseUser | null
  session: Session | null
  profile: User | null
  ngoProfile: NGO | null
}
