import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DashboardSection, DashboardView, SummaryCards } from './DashboardView'

describe('dashboard states', () => {
  it('renders loading without stale records', () => {
    const html = renderToStaticMarkup(<DashboardView title="Dashboard" description="Overview" loading error={null} refresh={() => {}}>Private record</DashboardView>)
    expect(html).toContain('Loading dashboard')
    expect(html).not.toContain('Private record')
  })
  it('shows a recoverable error without stale records', () => {
    const html = renderToStaticMarkup(<DashboardView title="Dashboard" description="Overview" loading={false} error="Connection failed" refresh={() => {}}>Private record</DashboardView>)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Try again')
    expect(html).not.toContain('Private record')
  })
  it('shows an informative empty section', () => {
    expect(renderToStaticMarkup(<DashboardSection title="Recent donations" empty="No donations yet." />)).toContain('No donations yet.')
  })
  it('does not fill an empty dashboard with zero-valued cards', () => {
    const html = renderToStaticMarkup(<SummaryCards summary={{ role: 'DONOR', counts: { total_donations: 0, active: 0 }, statuses: {} }} />)
    expect(html).toBe('')
  })
  it('shows actual nonzero counts without unrelated zero cards', () => {
    const html = renderToStaticMarkup(<SummaryCards summary={{ role: 'ADMIN', counts: { total_users: 1, donors: 1 }, statuses: {} }} />)
    expect(html).toContain('Total users')
    expect(html).not.toContain('Total donations')
  })
})
