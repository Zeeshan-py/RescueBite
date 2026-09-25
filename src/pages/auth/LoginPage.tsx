import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthShell } from '../../components/auth/AuthShell'
import { FormField, TextInput } from '../../components/auth/FormField'
import { signIn } from '../../services/auth/auth.service'
import { validateLogin, type FieldErrors } from '../../services/auth/auth.validation'
import { roleHomePath } from '../../auth/route-access'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors = validateLogin(email, password)
    setErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length) return
    setIsSubmitting(true)
    try {
      const result = await signIn(email, password)
      const requestedPath = (location.state as { from?: string } | null)?.from
      const destination = requestedPath?.startsWith(roleHomePath[result.profile.role]) ? requestedPath : roleHomePath[result.profile.role]
      navigate(destination, { replace: true })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Sign in failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell eyebrow="Welcome back" title="Continue your rescue work." description="Sign in with the email connected to your FoodBridge account.">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</div>}
        <FormField label="Email address" htmlFor="email" error={errors.email}>
          <TextInput id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} placeholder="you@example.com" />
        </FormField>
        <FormField label="Password" htmlFor="password" error={errors.password}>
          <TextInput id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} error={errors.password} placeholder="Enter your password" />
        </FormField>
        <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center rounded-lg bg-forest px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-pine disabled:cursor-wait disabled:opacity-65">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">New to FoodBridge? <Link to="/register" className="font-semibold text-forest underline-offset-4 hover:underline">Create an account</Link></p>
    </AuthShell>
  )
}
