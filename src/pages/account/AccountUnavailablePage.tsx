import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ErrorNotice, ErrorState } from '../../components/common/ErrorState'

export default function AccountUnavailablePage() {
  const { error, profile, logout } = useAuth()
  const [leaving, setLeaving] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const navigate = useNavigate()
  async function reset() {
    setLeaving(true); setLogoutError(null)
    try { await logout(); navigate('/login', { replace: true }) }
    catch { setLogoutError('We couldn’t sign you out. Please try again.'); setLeaving(false) }
  }
  return <main><ErrorState fullScreen kind="access" title={profile?.account_status === 'RESTRICTED' ? 'Your account is under review.' : 'We couldn’t open your profile.'} message={profile?.account_status === 'RESTRICTED' ? 'Access is restricted while your account is under review. Contact support if you believe this is a mistake.' : error ?? 'Your account profile is not available. Sign in again or contact support for help.'} actions={<><button type="button" disabled={leaving} onClick={() => void reset()} className="button-primary">{leaving ? 'Signing out…' : 'Return to sign in'}</button><Link className="button-secondary" to="/contact">Contact support</Link>{logoutError && <ErrorNotice message={logoutError} />}</>} /></main>
}
