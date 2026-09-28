import type { NgoDonationMatch, NgoWorkflowGroups } from './ngo-workflow.types'

export function isActionableMatch(item: NgoDonationMatch, now = new Date()): boolean {
  return ['SUGGESTED', 'VIEWED'].includes(item.status)
    && item.donation.status === 'MATCHED'
    && new Date(item.donation.collection_deadline) > now
}

export function groupNgoMatches(items: NgoDonationMatch[], now = new Date()): NgoWorkflowGroups {
  return {
    actionable: items.filter((item) => isActionableMatch(item, now)),
    accepted: items.filter((item) => item.status === 'ACCEPTED'),
    history: items.filter((item) => !isActionableMatch(item, now) && item.status !== 'ACCEPTED'),
  }
}
