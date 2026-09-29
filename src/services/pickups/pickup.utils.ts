import type { PickupGroups, PickupTaskWithDonation } from './pickup.types'

export function isPickupClaimable(task: PickupTaskWithDonation, now = new Date()): boolean {
  return task.status === 'AVAILABLE'
    && task.volunteer_id === null
    && task.donation.status === 'ACCEPTED'
    && new Date(task.donation.collection_deadline) > now
}

export function groupPickupTasks(tasks: PickupTaskWithDonation[], currentUserId: string, now = new Date()): PickupGroups {
  return {
    available: tasks.filter((task) => isPickupClaimable(task, now)),
    assigned: tasks.filter((task) => task.volunteer_id === currentUserId && task.status === 'ASSIGNED'),
    collected: tasks.filter((task) => task.volunteer_id === currentUserId && task.status === 'COLLECTED'),
    delivered: tasks.filter((task) => task.volunteer_id === currentUserId && task.status === 'DELIVERED'),
    unavailable: tasks.filter((task) => task.status === 'AVAILABLE' && !isPickupClaimable(task, now)),
  }
}
