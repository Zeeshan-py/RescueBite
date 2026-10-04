import type { PickupTaskStatus } from '../../types/domain'
import { StatusBadge } from '../common/StatusBadge'

export function PickupStatusBadge({ status }: { status: PickupTaskStatus }) { return <StatusBadge status={status} /> }
