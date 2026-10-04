import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LoadingState } from '../../components/common/LoadingState'
import { DonationStatusBadge } from '../../components/donations/DonationStatusBadge'
import { acceptDonation, declineMatch, getNgoDonationMatch } from '../../services/ngo/ngo-workflow.service'
import type { NgoDonationMatch } from '../../services/ngo/ngo-workflow.types'
import { isActionableMatch } from '../../services/ngo/ngo-workflow.utils'
import { PickupSummary } from '../../components/pickups/PickupSummary'
import { subscribeToDonationStatus, unsubscribeFromWorkflow } from '../../services/realtime/workflow-realtime.service'
import { ConfirmAction } from '../../components/common/ConfirmAction'
import { StatusBadge } from '../../components/common/StatusBadge'
import { LocationMap } from '../../components/maps/LocationMap'

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
const scoreLabels: Array<[keyof NgoDonationMatch, string]> = [['distance_score', 'Distance'], ['urgency_score', 'Urgency'], ['compatibility_score', 'Compatibility'], ['capacity_score', 'Capacity'], ['availability_score', 'Availability']]

export default function NgoDonationDetailsPage() {
  const { matchId } = useParams()
  const [item, setItem] = useState<NgoDonationMatch | null>(null), [loading, setLoading] = useState(true), [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null)
  useEffect(() => { if (!matchId) return; void getNgoDonationMatch(matchId).then(setItem).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)) }, [matchId])
  useEffect(() => {
    const donationId = item?.donation.id
    if (!donationId) return
    const channel = subscribeToDonationStatus(donationId, (donation) => setItem((current) => current ? { ...current, donation } : current))
    return () => { void unsubscribeFromWorkflow(channel) }
  }, [item?.donation.id])
  async function decide(decision: 'ACCEPT' | 'DECLINE') {
    if (!matchId) return
    setWorking(true); setError(null); setMessage(null)
    try { const updated = decision === 'ACCEPT' ? await acceptDonation(matchId) : await declineMatch(matchId); setItem(updated); setMessage(decision === 'ACCEPT' ? 'Donation accepted.' : 'Donation suggestion declined.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The decision could not be recorded.') }
    finally { setWorking(false) }
  }
  if (loading) return <LoadingState label="Loading donation opportunity…" />
  if (!item) return <div><Link to="/ngo/donations" className="text-sm font-semibold text-forest">← Matched donations</Link><p role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">{error ?? 'Donation match unavailable.'}</p></div>
  const donation = item.donation, actionable = isActionableMatch(item)
  return <div><Link to="/ngo/donations" className="text-sm font-semibold text-forest hover:underline">← Matched donations</Link>{message && <p role="status" className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">{message}</p>}{error && <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div className="mt-8 flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Donation opportunity</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">{donation.food_type}</h1><p className="mt-3 text-sm text-muted">Match status: <StatusBadge status={item.status} /></p></div><div className="text-right"><DonationStatusBadge status={donation.status} /><p className="mt-3 font-display text-4xl text-forest">{item.matching_score}%</p><p className="text-xs text-muted">matching score</p></div></div>
    <section className="mt-8 rounded-2xl border border-line bg-white p-5 sm:p-8"><h2 className="text-lg font-semibold">Donation information</h2><dl className="mt-6 grid gap-5 sm:grid-cols-2">{[['Quantity', donation.quantity], ['Meal portions', donation.meal_portions], ['Pickup location', donation.location], ['Available from', formatDate(donation.available_from)], ['Collection deadline', formatDate(donation.collection_deadline)], ['Description', donation.description || 'No description supplied.']].map(([label, value]) => <div key={label} className="border-b border-line pb-4"><dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt><dd className="mt-2 break-words text-sm">{String(value)}</dd></div>)}</dl><div className="mt-7"><LocationMap points={donation.latitude !== null && donation.longitude !== null ? [{ latitude: donation.latitude, longitude: donation.longitude, label: 'Donation pickup', description: donation.location }] : []} /></div><h2 className="mt-8 text-lg font-semibold">Score breakdown</h2>{item.distance_km !== null && <p className="mt-2 text-sm text-muted">Geographic distance: <strong>{item.distance_km.toFixed(1)} km</strong></p>}<dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">{scoreLabels.map(([key, label]) => <div key={key} className="rounded-lg bg-canvas p-4"><dt className="text-xs text-muted">{label}</dt><dd className="mt-2 text-lg font-semibold">{String(item[key])}</dd></div>)}</dl></section>
    <PickupSummary donation={donation} canConfirm onDonationChange={(updated) => setItem((current) => current ? { ...current, donation: updated } : current)} />
    {actionable ? <div className="mt-6 flex flex-col gap-3 sm:flex-row"><ConfirmAction label="Accept donation" title="Accept this donation?" description="Your organization will receive this donation and a pickup task will become available. Other NGO suggestions expire. There is no undo action on this page." disabled={working} onConfirm={() => decide('ACCEPT')} /><ConfirmAction label="Reject suggestion" title="Reject this suggestion?" description="This records your decision and removes this suggestion from your actionable matches. The decision remains in history and cannot be undone here." destructive disabled={working} onConfirm={() => decide('DECLINE')} /></div> : <p className="mt-6 rounded-xl border border-line bg-white p-5 text-sm text-muted">This suggestion is no longer actionable. Its decision remains available as workflow history.</p>}
  </div>
}
