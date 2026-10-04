import { useState } from 'react'
import { signInWithGoogle } from '../../services/auth/auth.service'

function GoogleMark() {
  return <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M21.35 12.04c0-.7-.06-1.38-.19-2.04H12v3.86h5.23a4.47 4.47 0 0 1-1.94 2.93v2.43h3.13c1.83-1.69 2.93-4.18 2.93-7.18Z" />
    <path fill="#34A853" d="M12 21.5c2.62 0 4.82-.87 6.42-2.28l-3.13-2.43c-.87.58-1.98.93-3.29.93-2.53 0-4.68-1.71-5.45-4.01H3.32v2.51A9.7 9.7 0 0 0 12 21.5Z" />
    <path fill="#FBBC05" d="M6.55 13.71a5.9 5.9 0 0 1 0-3.42V7.78H3.32a9.7 9.7 0 0 0 0 8.44l3.23-2.51Z" />
    <path fill="#EA4335" d="M12 6.28c1.42 0 2.69.49 3.69 1.46l2.76-2.76A9.22 9.22 0 0 0 12 2.5a9.7 9.7 0 0 0-8.68 5.28l3.23 2.51c.77-2.3 2.92-4.01 5.45-4.01Z" />
  </svg>
}

export function GoogleSignInButton({ mode = 'login' }: { mode?: 'login' | 'register' }) {
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
  return <div className="mb-7">
    <button type="button" onClick={() => void handleClick()} disabled={busy} aria-busy={busy} className="group flex min-h-13 w-full items-center justify-center gap-3 rounded-xl border border-[#d5dfd7] bg-white px-5 py-3.5 text-sm font-semibold text-ink shadow-[0_2px_7px_rgba(16,37,27,0.05)] transition-[border-color,background-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-forest/55 hover:bg-[#fcfefb] hover:shadow-[0_8px_24px_rgba(16,37,27,0.11)] active:translate-y-0 disabled:cursor-wait disabled:opacity-65 disabled:hover:translate-y-0 disabled:hover:shadow-none">
      {busy ? <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-forest/25 border-t-forest" aria-hidden="true" /> : <GoogleMark />}
      <span>{busy ? 'Connecting to Google…' : 'Continue with Google'}</span>
    </button>
    {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    <div className="mt-6 flex items-center gap-4 text-xs font-medium text-muted"><span className="h-px flex-1 bg-line" aria-hidden="true" /><span>{mode === 'register' ? 'Or create an account with email' : 'Or sign in with email'}</span><span className="h-px flex-1 bg-line" aria-hidden="true" /></div>
  </div>
}
