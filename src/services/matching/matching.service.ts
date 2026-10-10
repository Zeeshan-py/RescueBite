import { getSupabaseClient } from '../../lib/supabase'
import type { Match } from '../../types/domain'
import { getDonationById } from '../donations/donation.service'
import type { MatchingNgo, MatchingResult, RankedMatch } from './matching.types'
import { canGenerateMatches, rankEligibleNgos } from './matching.utils'

export class MatchingServiceError extends Error {
  constructor(message: string, public readonly code = 'MATCHING_ERROR') {
    super(message)
    this.name = 'MatchingServiceError'
  }
}

function matchingFailure(error: { message: string }): MatchingServiceError {
  const message = error.message.toLowerCase()
  if (message.includes('not authorized') || message.includes('row-level security')) return new MatchingServiceError('You do not have permission to match this donation.', 'UNAUTHORIZED')
  if (message.includes('not eligible') || message.includes('posted or matched')) return new MatchingServiceError('This donation is not eligible for matching.', 'INELIGIBLE_DONATION')
  if (message.includes('deadline')) return new MatchingServiceError('This donation has passed its collection deadline.', 'DEADLINE_PASSED')
  if (message.includes('fetch') || message.includes('network')) return new MatchingServiceError('The matching service could not be reached. Check your connection and try again.', 'NETWORK_ERROR')
  return new MatchingServiceError('Matches could not be generated. Please try again.')
}

async function loadNgos(donationId: string): Promise<MatchingNgo[]> {
  const { data, error } = await getSupabaseClient().rpc('get_matching_ngos', { target_donation_id: donationId })
  if (error) throw matchingFailure(error)
  return data as MatchingNgo[]
}

function mergeStoredMatches(matches: Match[], ngos: MatchingNgo[]): RankedMatch[] {
  const ngoById = new Map(ngos.map((ngo) => [ngo.id, ngo]))
  return matches.flatMap<RankedMatch>((match) => {
    const ngo = ngoById.get(match.ngo_id)
    return ngo ? [{
      matchId: match.id,
      status: match.status,
      ngoId: ngo.id,
      organizationName: ngo.organization_name,
      location: ngo.location,
      capacity: ngo.capacity,
      distanceKm: match.distance_km,
      distanceSource: match.distance_km === null ? 'text-fallback' : 'coordinates',
      matchingScore: match.matching_score,
      distanceScore: match.distance_score,
      urgencyScore: match.urgency_score,
      compatibilityScore: match.compatibility_score,
      capacityScore: match.capacity_score,
      availabilityScore: match.availability_score,
    }] : []
  }).sort((a, b) => b.matchingScore - a.matchingScore || a.organizationName.localeCompare(b.organizationName))
}

export async function getSuggestedMatches(donationId: string): Promise<MatchingResult> {
  const donation = await getDonationById(donationId)
  if (donation.recipient_scope === 'INDIVIDUAL_ONLY') return { donationId, matches: [] }
  const { data, error } = await getSupabaseClient().from('matches').select('*').eq('donation_id', donationId)
  if (error) throw matchingFailure(error)
  const stored = data as Match[]
  if (!stored.length) return { donationId, matches: [] }
  const acceptedIds = stored.filter((match) => match.status === 'ACCEPTED').map((match) => match.ngo_id)
  if (!['POSTED', 'MATCHED'].includes(donation.status) && !acceptedIds.length) return { donationId, matches: [] }
  const ngos = ['POSTED', 'MATCHED'].includes(donation.status) ? await loadNgos(donationId) : await (async () => {
    const { data, error: ngoError } = await getSupabaseClient().from('ngos').select('id,user_id,organization_name,location,capacity,accepted_food_types,latitude,longitude').in('id', acceptedIds)
    if (ngoError) throw matchingFailure(ngoError)
    return data as MatchingNgo[]
  })()
  return { donationId, matches: mergeStoredMatches(stored, ngos) }
}

export async function generateMatches(donationId: string, now = new Date()): Promise<MatchingResult> {
  const donation = await getDonationById(donationId)
  if (donation.recipient_scope === 'INDIVIDUAL_ONLY') throw new MatchingServiceError('This donation is for individuals.', 'INELIGIBLE_DONATION')
  if (!canGenerateMatches(donation.status)) throw new MatchingServiceError('This donation is not eligible for matching.', 'INELIGIBLE_DONATION')
  if (new Date(donation.collection_deadline) <= now) throw new MatchingServiceError('This donation has passed its collection deadline.', 'DEADLINE_PASSED')
  const ngos = await loadNgos(donationId)
  const ranked = rankEligibleNgos(donation, ngos, now)
  const candidates = ranked.map((match) => ({
    ngo_id: match.ngoId,
    matching_score: match.matchingScore,
    distance_score: match.distanceScore,
    urgency_score: match.urgencyScore,
    compatibility_score: match.compatibilityScore,
    capacity_score: match.capacityScore,
    availability_score: match.availabilityScore,
  }))
  const { data, error } = await getSupabaseClient().rpc('store_donation_matches', {
    target_donation_id: donationId,
    match_candidates: candidates,
  })
  if (error) throw matchingFailure(error)
  return { donationId, matches: mergeStoredMatches(data as Match[], ngos) }
}
