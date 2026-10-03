import { beforeEach, describe, expect, it, vi } from 'vitest'

const { client, profileQuery } = vi.hoisted(() => {
  const profileQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), abortSignal: vi.fn() }
  for (const method of ['select', 'eq', 'abortSignal'] as const) profileQuery[method].mockImplementation(() => profileQuery)
  return { profileQuery, client: { from: vi.fn(() => profileQuery), auth: { signInWithPassword: vi.fn(), signInWithOAuth: vi.fn(), signOut: vi.fn(), getSession: vi.fn(), signUp: vi.fn() } } }
})
vi.mock('../../lib/supabase', () => ({ getSupabaseClient: () => client }))
import { getCurrentSession, getProfile, signIn, signInWithGoogle, signOut } from './auth.service'

describe('Supabase authentication boundary', () => {
  beforeEach(() => vi.clearAllMocks())
  it('uses Supabase Google OAuth and the current origin callback', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://rescuebitee.netlify.app' } })
    client.auth.signInWithOAuth.mockResolvedValue({ error: null })
    try {
      await signInWithGoogle()
      expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'https://rescuebitee.netlify.app/auth/google/callback' } })
    } finally { vi.unstubAllGlobals() }
  })
  it('sanitizes Google provider configuration failures', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } })
    client.auth.signInWithOAuth.mockResolvedValue({ error: { message: 'internal provider secret details' } })
    try { await expect(signInWithGoogle()).rejects.toThrow('Authentication could not be completed.') }
    finally { vi.unstubAllGlobals() }
  })
  it('normalizes email and loads the authoritative profile after login', async () => {
    client.auth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'actor' }, session: { user: { id: 'actor' } } }, error: null })
    profileQuery.maybeSingle.mockResolvedValue({ data: { id: 'actor', role: 'DONOR' }, error: null })
    expect((await signIn('  USER@example.com ', 'Password1')).profile.role).toBe('DONOR')
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'Password1' })
    expect(profileQuery.eq).toHaveBeenCalledWith('id', 'actor')
    expect(profileQuery.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
  })
  it('sanitizes invalid login errors', async () => {
    client.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } })
    await expect(signIn('user@example.com', 'bad')).rejects.toThrow('The email or password is incorrect.')
  })
  it('never exposes unexpected authentication internals', async () => {
    client.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'SQL private users at internal stack' } })
    await expect(signIn('user@example.com', 'bad')).rejects.toThrow('Authentication could not be completed. Please try again.')
  })
  it('uses Supabase logout without a second token store', async () => {
    client.auth.signOut.mockResolvedValue({ error: null })
    await signOut()
    expect(client.auth.signOut).toHaveBeenCalledOnce()
  })
  it('reports failed remote logout instead of hiding it', async () => {
    client.auth.signOut.mockResolvedValue({ error: { message: 'network failure' } })
    await expect(signOut()).rejects.toThrow('Unable to reach the authentication service.')
  })
  it('returns no identity when the saved session is absent', async () => {
    client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    expect(await getCurrentSession()).toBeNull()
  })
  it('fails closed on a profile query error', async () => {
    profileQuery.maybeSingle.mockResolvedValue({ data: null, error: { message: 'internal SQL' } })
    await expect(getProfile('actor')).rejects.toThrow('Your profile could not be loaded.')
  })
})
