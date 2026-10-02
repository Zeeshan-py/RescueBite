import type { Coordinates } from './location.types'

const EARTH_RADIUS_KM = 6371

export function isValidLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90
}

export function isValidLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180
}

export function isValidCoordinates(value: { latitude?: unknown; longitude?: unknown } | null | undefined): value is Coordinates {
  return Boolean(value && isValidLatitude(value.latitude) && isValidLongitude(value.longitude))
}

function radians(degrees: number): number {
  return degrees * Math.PI / 180
}

/** Great-circle distance using the Haversine formula. */
export function calculateDistanceKm(from: Coordinates, to: Coordinates): number {
  if (!isValidCoordinates(from) || !isValidCoordinates(to)) throw new RangeError('Coordinates are outside the valid latitude or longitude range.')
  const latitudeDelta = radians(to.latitude - from.latitude)
  const longitudeDelta = radians(to.longitude - from.longitude)
  const startLatitude = radians(from.latitude)
  const endLatitude = radians(to.latitude)
  const rawA = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2
  const a = Math.min(1, Math.max(0, rawA))
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Local-delivery project assumption: <=2 km scores 100, <=5 scores 90,
 * <=10 scores 75, <=20 scores 50, <=30 scores 25, and longer trips score 0.
 */
export function calculateDistanceScoreFromKm(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new RangeError('Distance must be a non-negative finite number.')
  if (distanceKm <= 2) return 100
  if (distanceKm <= 5) return 90
  if (distanceKm <= 10) return 75
  if (distanceKm <= 20) return 50
  if (distanceKm <= 30) return 25
  return 0
}

export function formatCoordinates(coordinates: Coordinates): string {
  if (!isValidCoordinates(coordinates)) return 'Location not selected'
  return `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`
}
