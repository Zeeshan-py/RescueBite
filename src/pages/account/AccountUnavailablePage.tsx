import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'

export default function AccountUnavailablePage() {
  const { error, profile, logout } = useAuth()
  const navigate = useNavigate()
  async function reset() { await logout(); navigate('/login', { replace: true }) }
  return <div className="grid min-h-screen place-items-center bg-canvas px-5"><div className="max-w-md rounded-xl border border-line bg-white p-8 text-center"><p className="text-xs font-semibold tracking-widest text-forest uppercase">Account unavailable</p><h1 className="mt-3 font-display text-3xl">{profile?.account_status === 'RESTRICTED' ? 'Your account is restricted.' : 'We could not load your profile.'}</h1><p className="mt-4 text-sm leading-6 text-muted">{profile?.account_status === 'RESTRICTED' ? 'You cannot use this account while it is under review. Contact support if you believe this is a mistake.' : error ?? 'Your authenticated account does not have a usable application profile.'}</p><button onClick={() => void reset()} className="mt-6 rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white">Return to sign in</button></div></div>
}
