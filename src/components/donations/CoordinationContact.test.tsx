import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CoordinationContact } from './CoordinationContact'

describe('accepted donation contact', () => {
  it('renders a safe dial link when a participant supplies a mobile number', () => {
    const html = renderToStaticMarkup(<CoordinationContact title="Recipient contact" name="A recipient" phone="+92 (300) 123-4567" email="recipient@example.test" />)
    expect(html).toContain('href="tel:+923001234567"')
    expect(html).toContain('+92 (300) 123-4567')
    expect(html).toContain('recipient@example.test')
  })

  it('supports email coordination when no mobile number is supplied', () => {
    const html = renderToStaticMarkup(<CoordinationContact title="Donor contact" name="A donor" phone={null} email="donor@example.test" />)
    expect(html).toContain('Not provided')
    expect(html).not.toContain('href="tel:')
    expect(html).toContain('href="mailto:donor@example.test"')
  })
})
