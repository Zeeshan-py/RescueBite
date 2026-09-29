import type { Donation, PickupTask } from '../../types/domain'

export interface PickupTaskWithDonation extends PickupTask {
  donation: Donation
}

export interface PickupGroups {
  available: PickupTaskWithDonation[]
  assigned: PickupTaskWithDonation[]
  collected: PickupTaskWithDonation[]
  delivered: PickupTaskWithDonation[]
  unavailable: PickupTaskWithDonation[]
}
