import type { DonationStatus } from '../../types/domain'
import { StatusBadge } from '../common/StatusBadge'

export function DonationStatusBadge({ status }: { status: DonationStatus }) {
  return <StatusBadge status={status} />
}
