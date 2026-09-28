import type { Donation, Match } from '../../types/domain'

export interface NgoDonationMatch extends Match {
  donation: Donation
}

export interface NgoWorkflowGroups {
  actionable: NgoDonationMatch[]
  accepted: NgoDonationMatch[]
  history: NgoDonationMatch[]
}
