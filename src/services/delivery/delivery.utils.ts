import type { Donation, PickupTask } from '../../types/domain'

export function canMarkDelivered(task: PickupTask, currentUserId: string): boolean {
  return task.status === 'COLLECTED' && task.volunteer_id === currentUserId && task.delivered_at === null
}

export function canConfirmReceipt(donation: Donation, task: PickupTask | null): boolean {
  return donation.status === 'DELIVERED' && task?.status === 'DELIVERED' && task.delivered_at !== null
}
