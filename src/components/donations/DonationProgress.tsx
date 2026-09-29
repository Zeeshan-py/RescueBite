import type { DonationStatus } from '../../types/domain'

const journey: DonationStatus[] = ['POSTED', 'MATCHED', 'ACCEPTED', 'PICKUP_ASSIGNED', 'COLLECTED', 'DELIVERED', 'COMPLETED']

export function DonationProgress({ status }: { status: DonationStatus }) {
  const current = journey.indexOf(status)
  if (current < 0) return <p className="mt-4 text-sm text-muted">This rescue ended with status <strong>{status}</strong>.</p>
  return <ol aria-label="Donation progress" className="mt-5 grid gap-2 sm:grid-cols-7">
    {journey.map((step, index) => <li key={step} aria-current={index === current ? 'step' : undefined} className={`rounded-lg border px-3 py-3 text-xs font-semibold ${index <= current ? 'border-forest/30 bg-green-50 text-pine' : 'border-line bg-canvas text-muted'}`}><span aria-hidden="true" className="mr-2">{index < current ? '✓' : index + 1}</span>{step.replace('_', ' ')}</li>)}
  </ol>
}
