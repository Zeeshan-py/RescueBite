import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActivityChart, OutcomeChart } from './AnalyticsCharts'
import type { ImpactTrend } from '../../services/analytics/analytics.types'

const day: ImpactTrend = { date: '2026-10-01', posted: 5, completed: 2, portions: 34, donors: 0, ngos: 0, collected: 3, delivered: 2 }
describe('analytics chart data and accessibility', () => {
  it('provides exact activity totals and keyboard exploration instructions', () => {
    const html = renderToStaticMarkup(<ActivityChart trends={[day]} bucket="day" />)
    expect(html).toContain('Created: 5 across the reporting period')
    expect(html).toContain('Completed: 2 across the reporting period')
    expect(html).toContain('Use left and right arrow keys')
    expect(html).not.toContain('NaN')
  })
  it('shows an honest empty state with no invented series', () => {
    const html = renderToStaticMarkup(<ActivityChart trends={[]} bucket="month" />)
    expect(html).toContain('No activity in this period')
    expect(html).not.toContain('<polyline')
    expect(html).not.toContain('NaN')
  })
  it('uses collection and delivery events for volunteer charts', () => {
    const html = renderToStaticMarkup(<ActivityChart trends={[day]} bucket="day" volunteer />)
    expect(html).toContain('Collected: 3 across the reporting period')
    expect(html).toContain('Delivered: 2 across the reporting period')
    expect(html).not.toContain('Created: 5')
  })
  it('keeps delivery awaiting receipt separate from completed donations', () => {
    const html = renderToStaticMarkup(<OutcomeChart statuses={{ COMPLETED: 4, DELIVERED: 3, POSTED: 2, CANCELLED: 1, EXPIRED: 2, EXCEPTION: 1 }} />)
    expect(html).toContain('Completed: 4, In progress: 5, Cancelled or expired: 3, Needs attention: 1')
    expect(html).toContain('<strong>13</strong>')
  })
  it('renders empty outcome data without percentage or path errors', () => {
    const html = renderToStaticMarkup(<OutcomeChart statuses={{}} />)
    expect(html).toContain('No donations in the selected period')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
  })
})
