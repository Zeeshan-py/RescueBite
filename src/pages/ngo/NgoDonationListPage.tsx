import { useEffect, useMemo, useState } from 'react'
import { LoadingState } from '../../components/common/LoadingState'
import { NgoMatchCard } from '../../components/ngo/NgoMatchCard'
import { getNgoDonationMatches } from '../../services/ngo/ngo-workflow.service'
import type { NgoDonationMatch } from '../../services/ngo/ngo-workflow.types'
import { groupNgoMatches } from '../../services/ngo/ngo-workflow.utils'

export default function NgoDonationListPage({ acceptedOnly = false }: { acceptedOnly?: boolean }) {
  const [items, setItems] = useState<NgoDonationMatch[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null)
  useEffect(() => { void getNgoDonationMatches().then(setItems).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)) }, [])
  const groups = useMemo(() => groupNgoMatches(items), [items])
  const shown = acceptedOnly ? groups.accepted : [...groups.actionable, ...groups.history]
  if (loading) return <LoadingState label={acceptedOnly ? 'Loading accepted donations…' : 'Loading matched donations…'} />
  return <div><p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">NGO donation workflow</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">{acceptedOnly ? 'Accepted donations' : 'Matched donations'}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{acceptedOnly ? 'Donations accepted by your organization remain here after refresh.' : 'Suggestions are private to your organization. Review each opportunity before accepting or declining.'}</p>
    {error ? <p role="alert" className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : shown.length === 0 ? <div className="mt-9 rounded-2xl border border-dashed border-line bg-white p-10 text-center"><h2 className="font-display text-3xl">{acceptedOnly ? 'No accepted donations' : 'No matched donations'}</h2><p className="mt-3 text-sm text-muted">{acceptedOnly ? 'Accepted opportunities will appear here.' : 'There are no suggestions awaiting your organization.'}</p></div> : <div className="mt-8 grid gap-4">{shown.map((item) => <NgoMatchCard key={item.id} item={item} />)}</div>}
  </div>
}
