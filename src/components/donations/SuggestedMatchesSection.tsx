import { useEffect, useState } from 'react'
import type { Donation } from '../../types/domain'
import { generateMatches, getSuggestedMatches } from '../../services/matching/matching.service'
import type { RankedMatch } from '../../services/matching/matching.types'

const scoreLabels: Array<[keyof RankedMatch, string]> = [
  ['distanceScore', 'Distance'], ['urgencyScore', 'Urgency'], ['compatibilityScore', 'Food compatibility'],
  ['capacityScore', 'Capacity'], ['availabilityScore', 'Availability'],
]

export function SuggestedMatchesSection({ donation, onStatusChange }: { donation: Donation; onStatusChange: (status: 'POSTED' | 'MATCHED') => void }) {
  const [matches, setMatches] = useState<RankedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void getSuggestedMatches(donation.id).then((result) => { if (active) setMatches(result.matches) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Suggested NGOs could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [donation.id])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const result = await generateMatches(donation.id)
      setMatches(result.matches)
      onStatusChange(result.matches.length > 0 ? 'MATCHED' : 'POSTED')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Matches could not be generated.')
    } finally {
      setGenerating(false)
    }
  }

  const canMatch = donation.status === 'POSTED' || donation.status === 'MATCHED'
  return <section aria-labelledby="matches-heading" className="mt-5 rounded-2xl border border-line bg-white p-5 sm:p-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 id="matches-heading" className="text-lg font-semibold">Suggested NGOs</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Rule-based suggestions only. NGOs review matches in the next phase.</p></div>{canMatch && <button type="button" onClick={() => void handleGenerate()} disabled={generating} className="rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-pine disabled:cursor-wait disabled:opacity-60">{generating ? 'Calculating…' : matches.length ? 'Refresh matches' : 'Find matches'}</button>}</div>
    {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading ? <p className="mt-6 text-sm text-muted">Loading suggested NGOs…</p> : !matches.length ? <div className="mt-6 rounded-xl border border-dashed border-line p-6 text-center"><p className="text-sm font-semibold">No suitable NGOs found.</p><p className="mt-2 text-xs leading-5 text-muted">Add or update eligible NGO profiles, then try matching again.</p></div> : <div className="mt-6 grid gap-4">{matches.map((match, index) => <article key={match.ngoId} className="rounded-xl border border-line p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-muted">#{index + 1} suggestion</p><h3 className="mt-1 text-base font-semibold">{match.organizationName}</h3><p className="mt-1 text-sm text-muted">{match.location} · Capacity {match.capacity} portions</p></div><p className="font-display text-3xl text-forest">{match.matchingScore}%</p></div><dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-5">{scoreLabels.map(([key, label]) => <div key={key}><dt className="text-[11px] text-muted">{label}</dt><dd className="mt-1 text-sm font-semibold">{String(match[key])}</dd></div>)}</dl></article>)}</div>}
    <p className="mt-5 text-xs leading-5 text-muted">Distance uses exact normalized location text when available; otherwise it receives a neutral score because coordinates are not stored. Availability is a baseline assumption until volunteer schedules exist.</p>
  </section>
}
