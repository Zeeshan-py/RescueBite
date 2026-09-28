import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { LoadingState } from '../../components/common/LoadingState'
import { getNgoDonationMatches } from '../../services/ngo/ngo-workflow.service'
import type { NgoDonationMatch } from '../../services/ngo/ngo-workflow.types'
import { groupNgoMatches } from '../../services/ngo/ngo-workflow.utils'

export default function NgoDashboardPage() {
  const { profile, ngoProfile } = useAuth()
  const [items, setItems] = useState<NgoDonationMatch[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null)
  useEffect(() => { void getNgoDonationMatches().then(setItems).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)) }, [])
  const groups = useMemo(() => groupNgoMatches(items), [items])
  if (loading) return <LoadingState label="Loading your NGO workspace…" />
  return <div><p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">NGO workspace</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">Hello, {profile?.name?.split(' ')[0] ?? 'there'}.</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted">Review suitable food donations for {ngoProfile?.organization_name ?? 'your organization'} and record a decision securely.</p>
    {error && <p role="alert" className="mt-7 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {!error && <><div className="mt-10 grid gap-4 sm:grid-cols-3">{[['Awaiting decision', groups.actionable.length], ['Accepted', groups.accepted.length], ['Previous decisions', groups.history.length]].map(([label, value]) => <div key={label} className="rounded-xl border border-line bg-white p-5"><p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p><p className="mt-3 font-display text-4xl text-pine">{value}</p></div>)}</div><div className="mt-7 flex flex-wrap gap-4"><Link to="/ngo/donations" className="rounded-lg bg-pine px-5 py-3 text-sm font-semibold text-white">Review donations</Link><Link to="/ngo/accepted" className="rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-forest">Accepted donations</Link></div></>}
  </div>
}
