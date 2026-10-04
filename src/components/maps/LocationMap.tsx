import { divIcon, latLngBounds } from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import type { MapPoint } from '../../services/location/location.types'
import { isValidCoordinates } from '../../services/location/location.utils'
import { MapErrorBoundary } from './MapErrorBoundary'

const DEFAULT_CENTER: [number, number] = [31.5204, 74.3587]

function markerIcon(label: string) {
  return divIcon({ className: '', html: `<span class="foodbridge-map-marker">${label}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] })
}

function FitMap({ points }: { points: MapPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 1) map.setView([points[0]!.latitude, points[0]!.longitude], 14)
    if (points.length > 1) map.fitBounds(latLngBounds(points.map((point) => [point.latitude, point.longitude])), { padding: [35, 35], maxZoom: 14 })
  }, [map, points])
  return null
}

export function LocationMap({ points, ariaLabel = 'Location map', className = '' }: { points: MapPoint[]; ariaLabel?: string; className?: string }) {
  const [ready, setReady] = useState(false)
  const [tileError, setTileError] = useState(false)
  const validPoints = useMemo(() => points.filter(isValidCoordinates), [points])
  if (!validPoints.length) return <div className={`grid min-h-64 place-items-center rounded-xl border border-dashed border-line bg-canvas p-6 text-center text-sm text-muted ${className}`}>No map position is available. Use the written pickup and delivery locations to coordinate this rescue.</div>
  return <MapErrorBoundary><div role="region" aria-label={ariaLabel} className={`relative isolate min-h-64 overflow-hidden rounded-xl border border-line ${className}`}>
    {!ready && <div role="status" className="absolute inset-0 z-[500] grid place-items-center bg-canvas text-sm text-muted">Loading map…</div>}
    {tileError && <p role="alert" className="relative z-[501] bg-amber-50 p-3 text-xs text-amber-900">Map tiles could not load. Check your connection; written locations and coordinates remain available.</p>}
    <MapContainer center={DEFAULT_CENTER} zoom={12} scrollWheelZoom={false} className="h-72 w-full sm:h-80" whenReady={() => setReady(true)}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{ tileerror: () => setTileError(true) }} />
      <FitMap points={validPoints} />
      {validPoints.map((point, index) => <Marker key={`${point.label}-${point.latitude}-${point.longitude}`} position={[point.latitude, point.longitude]} title={point.label} alt={point.label} icon={markerIcon(String(index + 1))}><Popup><strong>{point.label}</strong>{point.description && <><br />{point.description}</>}</Popup></Marker>)}
    </MapContainer>
  </div></MapErrorBoundary>
}
