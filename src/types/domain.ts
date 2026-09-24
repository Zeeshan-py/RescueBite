/** ERD.md record shapes. UUIDs and ISO timestamps are serialized as strings. */
export type UserRole = 'DONOR' | 'NGO' | 'VOLUNTEER' | 'ADMIN'
export type DonationStatus =
  | 'POSTED' | 'MATCHED' | 'ACCEPTED' | 'PICKUP_ASSIGNED' | 'COLLECTED'
  | 'DELIVERED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'EXCEPTION'
export type MatchStatus = 'SUGGESTED' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
export type PickupTaskStatus = 'AVAILABLE' | 'ASSIGNED' | 'COLLECTED' | 'DELIVERED' | 'CANCELLED'

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  location: string
  created_at: string
}

export interface NGO {
  id: string
  user_id: string
  organization_name: string
  description: string
  location: string
  capacity: number
  accepted_food_types: string[]
  contact_information: string
  created_at: string
}

export interface Donation {
  id: string
  donor_id: string
  food_type: string
  quantity: number
  meal_portions: number
  location: string
  available_from: string
  collection_deadline: string
  safety_information: string
  description: string
  status: DonationStatus
  created_at: string
  updated_at: string
}

export interface Match {
  id: string
  donation_id: string
  ngo_id: string
  matching_score: number
  distance_score: number
  urgency_score: number
  compatibility_score: number
  capacity_score: number
  availability_score: number
  status: MatchStatus
  created_at: string
}

export interface PickupTask {
  id: string
  donation_id: string
  // AVAILABLE tasks have no volunteer; event timestamps are absent until the event.
  volunteer_id: string | null
  pickup_location: string
  delivery_location: string
  pickup_time: string | null
  collected_at: string | null
  delivered_at: string | null
  status: PickupTaskStatus
  notes: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  // ERD lists examples, not an exhaustive enum.
  type: string
  is_read: boolean
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  created_at: string
}
