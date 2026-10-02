import type { Donation, UserRole } from '../../types/domain'
import type { NgoDonationMatch } from '../ngo/ngo-workflow.types'
import type { PickupTaskWithDonation } from '../pickups/pickup.types'
import type { DeliveryStatus } from '../delivery/delivery.types'

export interface DashboardSummary {
  role: UserRole
  counts: Record<string, number>
  statuses: Record<string, number>
}
export interface DonorDashboard { summary: DashboardSummary; recent: Donation[] }
export interface NgoDashboard {
  summary: DashboardSummary
  pending: NgoDonationMatch[]
  accepted: NgoDonationMatch[]
  deliveries: NgoDonationMatch[]
}
export interface VolunteerDashboard {
  summary: DashboardSummary
  available: PickupTaskWithDonation[]
  assigned: PickupTaskWithDonation[]
  history: PickupTaskWithDonation[]
  destination: DeliveryStatus['receivingNgo']
}
export type AdminView = 'users' | 'donations' | 'ngos' | 'volunteers' | 'activity'
export type AdminRow = Record<string, string | number | boolean | string[] | null>
export interface AdminRecords { rows: AdminRow[]; total: number; page: number; page_size: number }
export interface AdminFilters {
  search: string; status: string; role: string; food: string
  action: string; entity: string; from: string; to: string
}
export interface AdminDashboard { summary: DashboardSummary; donations: AdminRecords; activity: AdminRecords }
