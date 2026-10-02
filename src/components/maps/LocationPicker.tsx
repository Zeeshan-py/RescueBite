import { divIcon } from 'leaflet'
import { useEffect, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { Coordinates } from '../../services/location/location.types'
import { formatCoordinates, isValidCoordinates } from '../../services/location/location.utils'
import { MapErrorBoundary } from './MapErrorBoundary'

const DEFAULT_CENTER: [number, number] = [31.5204, 74.3587]
const pin = divIcon({ className: '', html: '<span class="foodbridge-map-marker">1</span>', iconSize: [28, 28], iconAnchor: [14, 14] })

function MapSelection({ selection, onSelect }: { selection: Coordinates | null; onSelect: (coordinates: Coordinates) => void }) {
  const map = useMap()
  useMapEvents({ click: (event) => onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng }) })
  useEffect(() => { if (selection) map.panTo([selection.latitude, selection.longitude]) }, [map, selection])
  return selection ? <Marker position={[selection.latitude, selection.longitude]} icon={pin} /> : null
}

export function LocationPicker({ value, onChange, label = 'Select location on map' }: { value: Coordinates | null; onChange: (coordinates: Coordinates | null) => void; label?: string }) {
  const [selection, setSelection] = useState<Coordinates | null>(isValidCoordinates(value) ? value : null)
  const [ready, setReady] = useState(false)
  const [tileError, setTileError] = useState(false)
  return <MapErrorBoundary><section aria-label={label} className="overflow-hidden rounded-xl border border-line bg-canvas">
    <div className="flex flex-col gap-2 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-semibold">{label}</h3><p className="mt-1 text-xs text-muted">Click the map to place or move the marker.</p></div><p className="font-mono text-xs text-muted">{selection ? formatCoordinates(selection) : 'No coordinates selected'}</p></div>
    <div className="relative isolate">
      {!ready && <div className="absolute inset-0 z-[500] grid place-items-center bg-canvas text-sm text-muted">Loading map…</div>}
      {tileError && <p role="alert" className="relative z-[501] bg-amber-50 p-3 text-xs text-amber-900">Map tiles could not load. Check your connection; written locations and coordinates remain available.</p>}
    <MapContainer center={selection ? [selection.latitude, selection.longitude] : DEFAULT_CENTER} zoom={selection ? 14 : 12} scrollWheelZoom={false} className="h-72 w-full sm:h-80" whenReady={() => setReady(true)}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{ tileerror: () => setTileError(true) }} />
        <MapSelection selection={selection} onSelect={setSelection} />
      </MapContainer>
    </div>
    <div className="flex flex-col-reverse gap-3 border-t border-line bg-white p-4 sm:flex-row sm:justify-end">
      {(selection || value) && <button type="button" onClick={() => { setSelection(null); onChange(null) }} className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:bg-canvas">Clear location</button>}
      <button type="button" disabled={!selection} onClick={() => { if (selection) onChange(selection) }} className="rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Confirm location</button>
    </div>
    {value && <p role="status" className="border-t border-line bg-soft px-4 py-3 text-xs font-medium text-forest">Selected location confirmed: {formatCoordinates(value)}</p>}
  </section></MapErrorBoundary>
}
