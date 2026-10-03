import type { Donation, DonationStatus } from '../../types/domain'
import {
  BASIC_AVAILABILITY_SCORE,
  MATCHING_WEIGHTS,
  SAME_LOCATION_SCORE,
  UNKNOWN_DISTANCE_SCORE,
} from './matching.constants'
import type { MatchingNgo, MatchScores, RankedMatch } from './matching.types'
import { calculateDistanceKm, calculateDistanceScoreFromKm, isValidCoordinates } from '../location/location.utils'

const wildcardFoodTypes = new Set(['all', 'any', 'all types', 'all food types'])

function clamp(score: number): number {
  return Math.min(100, Math.max(0, score))
}
function roundScore(score: number): number {
  return Math.round(score * 100) / 100
}

export function normalizeFoodType(value: string): string {
  const [rawCategory = ''] = value.split(':', 1)
  const category = rawCategory.trim().toLowerCase()
  return category.replace(/\s+food$/, '').replace(/\s+/g, ' ')
}

function normalizeLocation(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Text addresses do not provide geographic distance. Exact normalized locations score 100; all others receive a neutral 50. */
export function calculateDistanceScore(donationLocation: string, ngoLocation: string): number {
  const donation = normalizeLocation(donationLocation)
  const ngo = normalizeLocation(ngoLocation)
  return donation && ngo && donation === ngo ? SAME_LOCATION_SCORE : UNKNOWN_DISTANCE_SCORE
}

export function calculateDistanceComponent(donation: Donation, ngo: MatchingNgo): Pick<RankedMatch, 'distanceKm' | 'distanceScore' | 'distanceSource'> {
  const donationCoordinates = { latitude: donation.latitude, longitude: donation.longitude }
  const ngoCoordinates = { latitude: ngo.latitude, longitude: ngo.longitude }
  if (isValidCoordinates(donationCoordinates) && isValidCoordinates(ngoCoordinates)) {
    const distanceKm = calculateDistanceKm(donationCoordinates, ngoCoordinates)
    return { distanceKm, distanceScore: calculateDistanceScoreFromKm(distanceKm), distanceSource: 'coordinates' }
  }
  return { distanceKm: null, distanceScore: calculateDistanceScore(donation.location, ngo.location), distanceSource: 'text-fallback' }
}

/** Shorter time remaining produces greater urgency. A passed deadline is not matchable and scores 0. */
export function calculateUrgencyScore(collectionDeadline: string, now = new Date()): number {
  const hours = (new Date(collectionDeadline).getTime() - now.getTime()) / 3_600_000
  if (!Number.isFinite(hours) || hours <= 0) return 0
  if (hours <= 2) return 100
  if (hours <= 6) return 90
  if (hours <= 12) return 75
  if (hours <= 24) return 60
  if (hours <= 48) return 40
  return 25
}

export function calculateCompatibilityScore(foodType: string, acceptedFoodTypes: string[]): number {
  const donationType = normalizeFoodType(foodType)
  const accepted = acceptedFoodTypes.map(normalizeFoodType)
  if (accepted.includes(donationType)) return 100
  if (accepted.some((type) => wildcardFoodTypes.has(type))) return 80
  return 0
}

/** Capacity represents meal portions. Exact capacity scores 50 and headroom rises linearly to 100 at twice the requirement. */
export function calculateCapacityScore(mealPortions: number, capacity: number): number {
  if (mealPortions <= 0 || capacity < mealPortions) return 0
  return roundScore(clamp(50 + 50 * ((capacity - mealPortions) / mealPortions)))
}

/** Volunteer schedules are unavailable in Phase 5, so eligible NGOs receive a documented neutral-positive baseline. */
export function calculateAvailabilityScore(): number {
  return BASIC_AVAILABILITY_SCORE
}

export function calculateMatchingScore(scores: Omit<MatchScores, 'matchingScore'>): number {
  return roundScore(
    scores.distanceScore * MATCHING_WEIGHTS.distance
    + scores.urgencyScore * MATCHING_WEIGHTS.urgency
    + scores.compatibilityScore * MATCHING_WEIGHTS.compatibility
    + scores.capacityScore * MATCHING_WEIGHTS.capacity
    + scores.availabilityScore * MATCHING_WEIGHTS.availability,
  )
}

export function canGenerateMatches(status: DonationStatus): boolean {
  return status === 'POSTED' || status === 'MATCHED'
}

export function isEligibleNgo(donation: Donation, ngo: MatchingNgo, now = new Date()): boolean {
  return ngo.user_id !== donation.donor_id
    && ngo.capacity >= donation.meal_portions
    && calculateCompatibilityScore(donation.food_type, ngo.accepted_food_types) > 0
    && calculateUrgencyScore(donation.collection_deadline, now) > 0
}

export function scoreNgo(donation: Donation, ngo: MatchingNgo, now = new Date()): RankedMatch {
  const distance = calculateDistanceComponent(donation, ngo)
  const components = {
    distanceScore: distance.distanceScore,
    urgencyScore: calculateUrgencyScore(donation.collection_deadline, now),
    compatibilityScore: calculateCompatibilityScore(donation.food_type, ngo.accepted_food_types),
    capacityScore: calculateCapacityScore(donation.meal_portions, ngo.capacity),
    availabilityScore: calculateAvailabilityScore(),
  }
  return {
    ngoId: ngo.id,
    organizationName: ngo.organization_name,
    location: ngo.location,
    capacity: ngo.capacity,
    distanceKm: distance.distanceKm,
    distanceSource: distance.distanceSource,
    ...components,
    matchingScore: calculateMatchingScore(components),
  }
}

export function rankEligibleNgos(donation: Donation, ngos: MatchingNgo[], now = new Date()): RankedMatch[] {
  if (!canGenerateMatches(donation.status) || calculateUrgencyScore(donation.collection_deadline, now) === 0) return []
  const uniqueNgos = [...new Map(ngos.map((ngo) => [ngo.id, ngo])).values()]
  return uniqueNgos.filter((ngo) => isEligibleNgo(donation, ngo, now)).map((ngo) => scoreNgo(donation, ngo, now))
    .sort((a, b) => b.matchingScore - a.matchingScore || a.organizationName.localeCompare(b.organizationName))
}
