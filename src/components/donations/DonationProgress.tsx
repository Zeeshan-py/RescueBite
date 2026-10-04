import type { DonationStatus } from '../../types/domain'
import { StatusBadge } from '../common/StatusBadge'

const journey: DonationStatus[] = ['POSTED', 'MATCHED', 'ACCEPTED', 'PICKUP_ASSIGNED', 'COLLECTED', 'DELIVERED', 'COMPLETED']

export function DonationProgress({ status }: { status: DonationStatus }) {
  const current = journey.indexOf(status)
  if (current < 0) return <div className="mt-4 space-y-3"><StatusBadge status={status} /><p className="text-sm text-muted">{status === 'EXCEPTION' ? 'This rescue needs attention. Review the latest workflow information.' : 'This rescue is no longer progressing. Its history remains available.'}</p></div>
  return <ol aria-label="Donation progress" className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
    {journey.map((step, index) => <li key={step} aria-current={index === current ? 'step' : undefined} className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-xs font-semibold ${index <= current ? 'border-forest/30 bg-green-50 text-pine' : 'border-line bg-canvas text-muted'}`}><span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full border border-current/20">{index < current ? '✓' : index + 1}</span><span>{step.replaceAll('_', ' ')}<span className="mt-1 block text-[11px] font-normal">{index < current ? 'Recorded' : index === current ? 'Current stage' : 'Upcoming'}</span></span></li>)}
  </ol>
}
