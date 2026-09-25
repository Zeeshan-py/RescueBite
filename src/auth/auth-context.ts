import { createContext } from 'react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import type { NGO, User, UserRole } from '../types/domain'

export interface AuthContextValue {
  user: SupabaseUser | null
  session: Session | null
  profile: User | null
  ngoProfile: NGO | null
  role: UserRole | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  refreshProfile: () => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
