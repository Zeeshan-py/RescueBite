import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { getSupabaseClient, supabaseConfigurationError } from '../lib/supabase'
import {
  ensureNgoProfileFromMetadata,
  getCurrentSession,
  getNgoProfile,
  loadProfile,
  signOut,
} from '../services/auth/auth.service'
import type { NGO, User } from '../types/domain'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [ngoProfile, setNgoProfile] = useState<NGO | null>(null)
  const [isLoading, setIsLoading] = useState(!supabaseConfigurationError)
  const [error, setError] = useState<string | null>(supabaseConfigurationError)
  const requestId = useRef(0)

  const applySession = useCallback(async (nextSession: Session | null) => {
    const currentRequest = ++requestId.current
    setSession(nextSession)
    setUser(nextSession?.user ?? null)
    setIsLoading(true)
    setError(null)
    if (!nextSession?.user) {
      setProfile(null)
      setNgoProfile(null)
      setIsLoading(false)
      return
    }
    try {
      const nextProfile = await loadProfile(nextSession.user)
      let nextNgoProfile: NGO | null = null
      if (nextProfile?.role === 'NGO') {
        nextNgoProfile = await ensureNgoProfileFromMetadata(nextSession.user)
      }
      if (currentRequest === requestId.current) {
        setProfile(nextProfile)
        setNgoProfile(nextNgoProfile)
      }
    } catch {
      if (currentRequest === requestId.current) setError('Your account profile could not be loaded. Please sign out and try again.')
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (supabaseConfigurationError) {
      return
    }
    let mounted = true
    void getCurrentSession().then((currentSession) => {
      if (mounted) void applySession(currentSession)
    }).catch(() => {
      if (mounted) {
        setError('The saved session could not be restored.')
        setIsLoading(false)
      }
    })
    const { data: { subscription } } = getSupabaseClient().auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => { if (mounted) void applySession(nextSession) }, 0)
    })
    return () => {
      mounted = false
      requestId.current += 1
      subscription.unsubscribe()
    }
  }, [applySession])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const nextProfile = await loadProfile(user)
    setProfile(nextProfile)
    if (nextProfile?.role === 'NGO') setNgoProfile(await getNgoProfile(user.id))
  }, [user])

  const logout = useCallback(async () => {
    await signOut()
    await applySession(null)
  }, [applySession])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    profile,
    ngoProfile,
    role: profile?.role ?? null,
    isLoading,
    isAuthenticated: Boolean(session && user),
    error,
    refreshProfile,
    logout,
  }), [error, isLoading, logout, ngoProfile, profile, refreshProfile, session, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
