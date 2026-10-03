import { describe, expect, it } from 'vitest'
import type { PublicRegistrationRole, SignUpInput } from './auth.types'
import { validateLogin, validateRegistration } from './auth.validation'

function registration(role: PublicRegistrationRole = 'DONOR'): SignUpInput {
  return {
    name: 'Test User',
    email: 'test@example.com',
    phone: '',
    password: 'StrongPass1',
    role,
    ngo: role === 'NGO' ? {
      organizationName: 'Community Kitchen',
      description: 'Test organization',
      location: 'Lahore',
      capacity: 50,
      acceptedFoodTypes: ['cooked meals'],
      contactInformation: '03000000000',
    } : undefined,
  }
}

describe('authentication validation', () => {
  it.each(['DONOR', 'NGO', 'VOLUNTEER'] as PublicRegistrationRole[])('accepts a valid %s registration', (role) => {
    expect(validateRegistration(registration(role), 'StrongPass1')).toEqual({})
  })

  it('blocks password mismatch and weak passwords', () => {
    const input = registration()
    input.password = 'weak'
    const errors = validateRegistration(input, 'different')
    expect(errors.password).toBeTruthy()
    expect(errors.confirmPassword).toBe('Passwords do not match.')
  })

  it('does not accept ADMIN as a public role', () => {
    const input = registration()
    input.role = 'ADMIN' as PublicRegistrationRole
    expect(validateRegistration(input, input.password).role).toBeTruthy()
  })

  it('requires the NGO organization fields', () => {
    const input = registration('NGO')
    input.ngo = { organizationName: '', description: '', location: '', capacity: -1, acceptedFoodTypes: [], contactInformation: '' }
    const errors = validateRegistration(input, input.password)
    expect(errors).toMatchObject({ organizationName: expect.any(String), ngoLocation: expect.any(String), capacity: expect.any(String), acceptedFoodTypes: expect.any(String), contactInformation: expect.any(String) })
  })

  it('validates missing and malformed login fields', () => {
    expect(validateLogin('not-an-email', '')).toEqual({ email: 'Enter a valid email address.', password: 'Password is required.' })
  })
  it('rejects oversized names and invalid NGO capacity integers', () => {
    expect(validateRegistration({ ...registration(), name: 'x'.repeat(201) }, 'StrongPass1').name).toBeTruthy()
    const input = registration('NGO')
    input.ngo!.capacity = 1.5
    expect(validateRegistration(input, input.password).capacity).toBeTruthy()
  })
})
