import type { Donation, Match, NGO } from '../../types/domain'

export type MatchingNgo = Pick<NGO, 'id' | 'user_id' | 'organization_name' | 'location' | 'capacity' | 'accepted_food_types' | 'latitude' | 'longitude'>

export interface MatchScores {
  distanceScore: number
  urgencyScore: number
  compatibilityScore: number
  capacityScore: number
  availabilityScore: number
  matchingScore: number
}

export interface RankedMatch extends MatchScores {
  ngoId: string
  organizationName: string
  location: string
  capacity: number
  distanceKm: number | null
  distanceSource: 'coordinates' | 'text-fallback'
  matchId?: string
  status?: Match['status']
}

export interface MatchingResult {
  donationId: string
  matches: RankedMatch[]
}

export interface MatchingContext {
  donation: Donation
  ngo: NGO
  now?: Date
}
