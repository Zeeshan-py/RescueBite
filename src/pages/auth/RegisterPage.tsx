import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthShell } from '../../components/auth/AuthShell'
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton'
import { FormField, TextInput } from '../../components/auth/FormField'
import { roleHomePath } from '../../auth/route-access'
import { signUp } from '../../services/auth/auth.service'
import type { PublicRegistrationRole, SignUpInput } from '../../services/auth/auth.types'
import { validateRegistration, type FieldErrors } from '../../services/auth/auth.validation'

const roles: Array<{ value: PublicRegistrationRole; label: string; description: string }> = [
  { value: 'DONOR', label: 'Donor', description: 'Share surplus food.' },
  { value: 'NGO', label: 'NGO', description: 'Receive and distribute food.' },
  { value: 'VOLUNTEER', label: 'Volunteer', description: 'Help with pickup and delivery.' },
]

const initialNgo = { organizationName: '', description: '', location: '', capacity: 0, acceptedFoodTypes: [] as string[], contactInformation: '' }

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<PublicRegistrationRole>('DONOR')
  const [ngo, setNgo] = useState(initialNgo)
  const [foodTypesText, setFoodTypesText] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)
  const navigate = useNavigate()

  const input = useMemo<SignUpInput>(() => ({
    name, email, phone, password, role,
    ngo: role === 'NGO' ? { ...ngo, acceptedFoodTypes: foodTypesText.split(',').map((item) => item.trim()).filter(Boolean) } : undefined,
  }), [email, foodTypesText, name, ngo, password, phone, role])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors = validateRegistration(input, confirmPassword)
    setErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length) return
    setIsSubmitting(true)
    try {
      const result = await signUp(input)
      if (result.requiresEmailConfirmation) setConfirmationEmail(email.trim().toLowerCase())
      else navigate(roleHomePath[role], { replace: true })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Account creation failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (confirmationEmail) {
    return (
      <AuthShell eyebrow="Check your inbox" title="Confirm your email." description="Your secure account and profile have been prepared.">
        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">
          <div className="grid size-11 place-items-center rounded-full bg-soft text-xl text-forest" aria-hidden="true">✓</div>
          <p className="mt-5 text-sm leading-6 text-muted">We sent a confirmation link to <strong className="text-ink">{confirmationEmail}</strong>. Open it to activate your account, then return here to sign in.</p>
          <Link to="/login" className="mt-6 inline-flex rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-pine">Go to sign in</Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell eyebrow="Join the network" title="Create your FoodBridge account." description="Choose how you participate. Administrator accounts are provisioned separately.">
      <GoogleSignInButton />
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {formError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</div>}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">I am joining as</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {roles.map((option) => (
              <label key={option.value} className={`cursor-pointer rounded-xl border p-4 transition ${role === option.value ? 'border-forest bg-soft ring-1 ring-forest' : 'border-line bg-white hover:border-forest/40'}`}>
                <input type="radio" name="role" value={option.value} checked={role === option.value} onChange={() => setRole(option.value)} className="mr-2 accent-forest" />
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted">{option.description}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Full name" required htmlFor="name" error={errors.name}><TextInput id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} /></FormField>
          <FormField label="Phone" htmlFor="phone" hint="Optional"><TextInput id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></FormField>
        </div>
        <FormField label="Email address" required htmlFor="email" error={errors.email}><TextInput id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} /></FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Password" required htmlFor="password" error={errors.password} hint="8+ characters with uppercase, lowercase, and a number."><TextInput id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} /></FormField>
          <FormField label="Confirm password" required htmlFor="confirm-password" error={errors.confirmPassword}><TextInput id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={errors.confirmPassword} /></FormField>
        </div>

        {role === 'NGO' && (
          <fieldset className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <legend className="px-2 font-display text-xl">Organization profile</legend>
            <div className="mt-2 grid gap-5 sm:grid-cols-2">
              <FormField label="Organization name" required htmlFor="organization-name" error={errors.organizationName}><TextInput id="organization-name" value={ngo.organizationName} onChange={(e) => setNgo({ ...ngo, organizationName: e.target.value })} error={errors.organizationName} /></FormField>
              <FormField label="Location" required htmlFor="ngo-location" error={errors.ngoLocation}><TextInput id="ngo-location" value={ngo.location} onChange={(e) => setNgo({ ...ngo, location: e.target.value })} error={errors.ngoLocation} /></FormField>
              <FormField label="Receiving capacity" required htmlFor="capacity" error={errors.capacity} hint="Approximate meal portions"><TextInput id="capacity" type="number" min="0" value={ngo.capacity} onChange={(e) => setNgo({ ...ngo, capacity: Number(e.target.value) })} error={errors.capacity} /></FormField>
              <FormField label="Contact information" required htmlFor="contact-information" error={errors.contactInformation}><TextInput id="contact-information" value={ngo.contactInformation} onChange={(e) => setNgo({ ...ngo, contactInformation: e.target.value })} error={errors.contactInformation} /></FormField>
              <FormField label="Accepted food types" required htmlFor="accepted-food-types" error={errors.acceptedFoodTypes} hint="Comma-separated, for example: cooked meals, bakery"><TextInput id="accepted-food-types" value={foodTypesText} onChange={(e) => setFoodTypesText(e.target.value)} error={errors.acceptedFoodTypes} /></FormField>
              <FormField label="Description" htmlFor="ngo-description" hint="Optional"><TextInput id="ngo-description" value={ngo.description} onChange={(e) => setNgo({ ...ngo, description: e.target.value })} /></FormField>
            </div>
          </fieldset>
        )}

        <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center rounded-lg bg-forest px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-pine disabled:cursor-wait disabled:opacity-65">{isSubmitting ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Already registered? <Link to="/login" className="font-semibold text-forest underline-offset-4 hover:underline">Sign in</Link></p>
    </AuthShell>
  )
}
