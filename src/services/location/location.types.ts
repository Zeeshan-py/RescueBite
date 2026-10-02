export interface Coordinates {
  latitude: number
  longitude: number
}

export interface MapPoint extends Coordinates {
  label: string
  description?: string
}
