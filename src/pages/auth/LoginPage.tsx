import { ErrorNotice } from '../../components/common/ErrorState'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthShell } from '../../components/auth/AuthShell'
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton'
import { FormField, TextInput } from '../../components/auth/FormField'
import { signIn } from '../../services/auth/auth.service'
import { validateLogin, type FieldErrors } from '../../services/auth/auth.validation'
import { PasswordInput } from '../../components/auth/PasswordInput'
import { Icon } from '../../components/common/Icon'
import { roleHomePath } from '../../auth/route-access'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const logoutWarning = (location.state as { logoutWarning?: string } | null)?.logoutWarning

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
    <AuthShell eyebrow="Your RescueBite account" title="Welcome back." description="Sign in to pick up where you left off.">
      <GoogleSignInButton />
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {logoutWarning && <p role="alert" className="text-sm text-amber-900">{logoutWarning}</p>}
        {formError && <ErrorNotice message={formError} />}
        <FormField label="Email address" required htmlFor="email" error={errors.email}>
          <TextInput id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} placeholder="you@example.com" />
        </FormField>
        <FormField label="Password" required htmlFor="password" error={errors.password}>
          <PasswordInput id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} error={errors.password} placeholder="Enter your password" />
        </FormField>
        <button type="submit" disabled={isSubmitting} className="auth-submit">
          {isSubmitting ? 'Signing in…' : 'Sign in'}{!isSubmitting && <Icon name="arrow" width="18" />}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">New to RescueBite? <Link to="/register" className="font-semibold text-forest underline-offset-4 hover:underline">Create an account</Link></p>
    </AuthShell>
  )
}
