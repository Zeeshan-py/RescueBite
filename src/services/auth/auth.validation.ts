import type { PublicRegistrationRole, SignUpInput } from './auth.types'

export type FieldErrors = Record<string, string>

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const publicRoles: PublicRegistrationRole[] = ['DONOR', 'NGO', 'VOLUNTEER']

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required.'
  if (!emailPattern.test(email.trim())) return 'Enter a valid email address.'
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.'
  if (password.length < 8) return 'Use at least 8 characters.'
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Include an uppercase letter, a lowercase letter, and a number.'
  }
  return null
}

export function validateLogin(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  const emailError = validateEmail(email)
  if (emailError) errors.email = emailError
  if (!password) errors.password = 'Password is required.'
  return errors
}

export function validateRegistration(input: SignUpInput, confirmPassword: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!input.name.trim()) errors.name = 'Name is required.'
  const emailError = validateEmail(input.email)
  if (emailError) errors.email = emailError
  const passwordError = validatePassword(input.password)
  if (passwordError) errors.password = passwordError
  if (!confirmPassword) errors.confirmPassword = 'Confirm your password.'
  else if (confirmPassword !== input.password) errors.confirmPassword = 'Passwords do not match.'
  if (!publicRoles.includes(input.role)) errors.role = 'Choose a valid account type.'

  if (input.role === 'NGO') {
    if (!input.ngo?.organizationName.trim()) errors.organizationName = 'Organization name is required.'
    if (!input.ngo?.location.trim()) errors.ngoLocation = 'Organization location is required.'
    if (input.ngo && (!Number.isFinite(input.ngo.capacity) || input.ngo.capacity < 0)) {
      errors.capacity = 'Capacity must be zero or greater.'
    }
    if (!input.ngo?.acceptedFoodTypes.length) errors.acceptedFoodTypes = 'Add at least one accepted food type.'
    if (!input.ngo?.contactInformation.trim()) errors.contactInformation = 'Contact information is required.'
  }

  return errors
}
