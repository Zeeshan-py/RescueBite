import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FormField, TextInput } from '../auth/FormField'
import { DonationProgress } from '../donations/DonationProgress'
import { DonationStatusBadge } from '../donations/DonationStatusBadge'
import { PickupStatusBadge } from '../pickups/PickupStatusBadge'
import { ConfirmAction } from './ConfirmAction'
import { NotificationList } from '../notifications/NotificationList'

describe('accessible presentation', () => {
  it('associates required fields with both persistent hints and errors', () => {
    const html = renderToStaticMarkup(<FormField required label="Name" htmlFor="name" hint="Your full name" error="Enter a name"><TextInput id="name" error="Enter a name" /></FormField>)
    expect(html).toContain('aria-describedby="name-hint name-error"')
    expect(html).toContain('aria-required="true"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('id="name-hint"')
    expect(html).toContain('id="name-error"')
  })
  it('uses identical collected and delivered badges across workflows', () => {
    for (const status of ['COLLECTED','DELIVERED','CANCELLED'] as const) expect(renderToStaticMarkup(<DonationStatusBadge status={status} />)).toBe(renderToStaticMarkup(<PickupStatusBadge status={status} />))
  })
  it('identifies exactly one current step and distinguishes future steps', () => {
    const html = renderToStaticMarkup(<DonationProgress status="COLLECTED" />)
    expect(html.match(/aria-current="step"/g)).toHaveLength(1)
    expect(html).toContain('Current stage')
    expect(html).toContain('Upcoming')
  })
  it('does not present an exception as a successfully ended rescue', () => {
    const html = renderToStaticMarkup(<DonationProgress status="EXCEPTION" />)
    expect(html).toContain('needs attention')
    expect(html).not.toContain('aria-current')
  })
  it('provides labelled confirmation content and a safe back action', () => {
    const html = renderToStaticMarkup(<ConfirmAction label="Cancel donation" title="Cancel this rescue?" description="This cannot be undone here." destructive onConfirm={async () => {}} />)
    expect(html).toContain('<dialog')
    expect(html).toContain('aria-labelledby=')
    expect(html).toContain('aria-describedby=')
    expect(html).toContain('Go back')
  })
  it('gives an informative notification empty state without a fake record', () => {
    const html = renderToStaticMarkup(<NotificationList notifications={[]} onMarkRead={async () => {}} />)
    expect(html).toContain('Workflow updates will appear here.')
    expect(html).not.toContain('Mark as read')
  })
})
