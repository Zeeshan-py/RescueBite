import { useState } from 'react'
import { signInWithGoogle } from '../../services/auth/auth.service'

export function GoogleSignInButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function handleClick() {
    setBusy(true)
    setError(null)
    try { await signInWithGoogle() } catch {
      setError('Google sign-in could not be started. Please try again.')
      setBusy(false)
    }
  }
  return <div className="mb-6 space-y-3">
    <button type="button" onClick={() => void handleClick()} disabled={busy} className="w-full rounded-lg border border-line bg-white px-5 py-3.5 text-sm font-semibold text-ink hover:bg-soft disabled:opacity-65">
      {busy ? 'Connecting to Google…' : 'Continue with Google'}
    </button>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    <p className="text-center text-xs text-muted">Or continue with email</p>
  </div>
}
