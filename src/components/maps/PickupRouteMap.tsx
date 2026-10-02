import type { Coordinates } from '../../services/location/location.types'
import { isValidCoordinates } from '../../services/location/location.utils'
import { LocationMap } from './LocationMap'

export function PickupRouteMap({ pickup, destination, pickupLabel, destinationLabel }: { pickup: Coordinates | null; destination: Coordinates | null; pickupLabel: string; destinationLabel: string }) {
  const points = [
    ...(isValidCoordinates(pickup) ? [{ ...pickup, label: 'Pickup', description: pickupLabel }] : []),
    ...(isValidCoordinates(destination) ? [{ ...destination, label: 'Destination NGO', description: destinationLabel }] : []),
  ]
  return <div><LocationMap points={points} ariaLabel="Pickup and destination map" />{points.length === 1 && <p className="mt-3 text-xs text-muted">Only one workflow location has coordinates. The other location remains available as text.</p>}</div>
}
