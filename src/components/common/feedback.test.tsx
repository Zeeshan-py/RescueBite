import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ErrorNotice, ErrorState } from './ErrorState'
import { LoadingState } from './LoadingState'

describe('feedback states', () => {
  it('announces the real loading task without fabricated progress', () => {
    const html = renderToStaticMarkup(<LoadingState label="Loading donations…" />)
    expect(html).toContain('role="status"')
    expect(html).toContain('Loading donations…')
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain('aria-valuenow')
    expect(html).not.toContain('role="alert"')
  })
  it('offers recovery only when an action is supplied', () => {
    expect(renderToStaticMarkup(<ErrorState />)).not.toContain('<button')
    const html = renderToStaticMarkup(<ErrorState onRetry={() => {}} />)
    expect(html).toContain('type="button"')
    expect(html).toContain('Try again')
    expect(html).toContain('role="alert"')
  })
  it('keeps an explanatory access message and a page heading', () => {
    const html = renderToStaticMarkup(<ErrorState fullScreen kind="access" title="Account restricted" message="Contact support to review your access." />)
    expect(html).toContain('<h1>Account restricted</h1>')
    expect(html).toContain('Contact support to review your access.')
  })
  it('renders alert text as text rather than markup', () => {
    const html = renderToStaticMarkup(<ErrorNotice message={'<script>secret</script>'} />)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
