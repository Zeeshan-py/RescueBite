import { getSupabaseClient } from '../../lib/supabase'
import type { NgoDonationMatch } from './ngo-workflow.types'

export class NgoWorkflowError extends Error {
  constructor(message: string, public readonly code = 'NGO_WORKFLOW_ERROR') {
    super(message)
    this.name = 'NgoWorkflowError'
  }
}

function failure(error: { message: string }): NgoWorkflowError {
  const message = error.message.toLowerCase()
  if (message.includes('only ngo') || message.includes('not authorized') || message.includes('row-level security')) return new NgoWorkflowError('You do not have permission to perform this NGO action.', 'UNAUTHORIZED')
  if (message.includes('deadline')) return new NgoWorkflowError('This donation has passed its collection deadline.', 'EXPIRED')
  if (message.includes('no longer') || message.includes('current state')) return new NgoWorkflowError('This donation opportunity is no longer available.', 'NOT_ACTIONABLE')
  if (message.includes('fetch') || message.includes('network')) return new NgoWorkflowError('FoodBridge could not reach the server. Check your connection and try again.', 'NETWORK_ERROR')
  return new NgoWorkflowError('The NGO workflow could not be completed. Please try again.')
}

async function refreshExpiry(): Promise<void> {
  const { error } = await getSupabaseClient().rpc('expire_overdue_donations')
  if (error) throw failure(error)
}

export async function getNgoDonationMatches(): Promise<NgoDonationMatch[]> {
  await refreshExpiry()
  const { data, error } = await getSupabaseClient().from('matches')
    .select('*, donation:donations(*)').order('created_at', { ascending: false })
  if (error) throw failure(error)
  return data as unknown as NgoDonationMatch[]
}

export async function getNgoDonationMatch(matchId: string): Promise<NgoDonationMatch> {
  await refreshExpiry()
  const { data, error } = await getSupabaseClient().from('matches')
    .select('*, donation:donations(*)').eq('id', matchId).maybeSingle()
  if (error) throw failure(error)
  if (!data) throw new NgoWorkflowError('Donation match not found or you do not have permission to view it.', 'NOT_FOUND')
  return data as unknown as NgoDonationMatch
}

async function respond(matchId: string, decision: 'ACCEPT' | 'DECLINE'): Promise<NgoDonationMatch> {
  const { error } = await getSupabaseClient().rpc('respond_to_donation_match', { target_match_id: matchId, decision })
  if (error) throw failure(error)
  return getNgoDonationMatch(matchId)
}

export const acceptDonation = (matchId: string) => respond(matchId, 'ACCEPT')
export const declineMatch = (matchId: string) => respond(matchId, 'DECLINE')
