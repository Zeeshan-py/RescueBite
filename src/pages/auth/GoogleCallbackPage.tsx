import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { roleHomePath } from '../../auth/route-access'
import { AuthShell } from '../../components/auth/AuthShell'
import { LoadingState } from '../../components/common/LoadingState'
import { completeGoogleProfile } from '../../services/auth/auth.service'
import type { PublicRegistrationRole } from '../../services/auth/auth.types'

export default function GoogleCallbackPage() {
  const { user, role, isLoading, error, refreshProfile } = useAuth()
  const [selectedRole, setSelectedRole] = useState<PublicRegistrationRole>('DONOR')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const params = new URLSearchParams(window.location.search)
  const fragment = new URLSearchParams(window.location.hash.slice(1))
  const denied = params.has('error') || fragment.has('error')
  if (isLoading) return <LoadingState label="Completing Google sign-in…" fullScreen />
  if (role) return <Navigate to={roleHomePath[role]} replace />
  async function complete() {
    if (!user) return
    setBusy(true)
    setSaveError(null)
    try { await completeGoogleProfile(user, selectedRole); await refreshProfile() }
    catch { setSaveError('Your account could not be completed. Please try again.') }
    finally { setBusy(false) }
  }
  return <AuthShell eyebrow="Google sign-in" title="Welcome to RescueBite." description="Complete your account to start rescuing food.">
    {denied || !user || error ? <div role="alert" className="space-y-4">
      <p>Google sign-in could not be completed. Please return to sign in and try again.</p>
      <Link to="/login" className="font-semibold text-forest">Return to sign in</Link>
    </div> : <div className="space-y-5">
      <p className="text-sm text-muted">Choose how you participate. NGO accounts complete their organization details next.</p>
      <label className="block text-sm font-semibold">Account role
        <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as PublicRegistrationRole)} className="mt-2 block w-full rounded-lg border border-line bg-white p-3">
          <option value="DONOR">Donor</option><option value="NGO">NGO</option><option value="VOLUNTEER">Volunteer</option>
        </select>
      </label>
      {saveError && <p role="alert" className="text-sm text-red-800">{saveError}</p>}
      <button disabled={busy} onClick={() => void complete()} className="w-full rounded-lg bg-forest px-5 py-3.5 font-semibold text-white disabled:opacity-65">{busy ? 'Saving…' : 'Complete account'}</button>
    </div>}
  </AuthShell>
}
