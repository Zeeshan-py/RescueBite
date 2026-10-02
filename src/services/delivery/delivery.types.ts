import type { Donation, NGO, PickupTask } from '../../types/domain'

export interface DeliveryStatus {
  pickup: PickupTask | null
  receivingNgo: Pick<NGO, 'id' | 'organization_name' | 'location' | 'latitude' | 'longitude'> | null
}

export interface DeliveryView {
  donation: Donation
  status: DeliveryStatus
}
