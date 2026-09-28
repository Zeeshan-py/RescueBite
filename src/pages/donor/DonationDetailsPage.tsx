import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { LoadingState } from '../../components/common/LoadingState'
import { DonationStatusBadge } from '../../components/donations/DonationStatusBadge'
import { SuggestedMatchesSection } from '../../components/donations/SuggestedMatchesSection'
import { cancelDonation, getDonationById } from '../../services/donations/donation.service'
import type { Donation } from '../../types/domain'

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
export default function DonationDetailsPage() {
  const { id } = useParams(), location = useLocation(), navigate = useNavigate()
  const [donation, setDonation] = useState<Donation | null>(null), [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false), [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>((location.state as { message?: string } | null)?.message ?? null)
  useEffect(() => {
    if ((location.state as { message?: string } | null)?.message) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])
  useEffect(() => {
    let active = true
    if (!id) return
    void getDonationById(id).then((result) => {
      if (active) setDonation(result)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Donation not found or you do not have permission to view it.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [id])
  async function handleCancel() { if (!id || !window.confirm('Cancel this donation? The record will remain in your history.')) return; setCancelling(true); setError(null); try { setDonation(await cancelDonation(id)); setMessage('Donation cancelled. The record remains available in your history.') } catch (e) { setError(e instanceof Error ? e.message : 'The donation could not be cancelled.') } finally { setCancelling(false) } }
  if (loading) return <LoadingState label="Loading donation details…" />
  if (!donation) return <div><Link to="/donor/donations" className="text-sm font-semibold text-forest">← My donations</Link><div className="mt-8 rounded-xl border border-line bg-white p-8"><h1 className="font-display text-3xl">Donation unavailable</h1><p role="alert" className="mt-3 text-sm text-muted">{error ?? 'Donation not found or you do not have permission to view it.'}</p></div></div>
  const editable = donation.status === 'POSTED'
  const cancellable = ['POSTED', 'MATCHED', 'ACCEPTED'].includes(donation.status)
  const fields = [['Quantity', String(donation.quantity)], ['Meal portions', String(donation.meal_portions)], ['Pickup location', donation.location], ['Available from', formatDate(donation.available_from)], ['Collection deadline', formatDate(donation.collection_deadline)], ['Created', formatDate(donation.created_at)]]
  return <div><Link to="/donor/donations" className="text-sm font-semibold text-forest hover:underline">← My donations</Link>{message && <p role="status" className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">{message}</p>}{error && <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}<div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Donation details</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">{donation.food_type}</h1></div><DonationStatusBadge status={donation.status} /></div>
    <section aria-labelledby="details-heading" className="mt-8 rounded-2xl border border-line bg-white p-5 sm:p-8"><h2 id="details-heading" className="text-lg font-semibold">Donation information</h2><dl className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="border-b border-line pb-4"><dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt><dd className="mt-2 break-words text-sm">{value}</dd></div>)}</dl><div className="mt-6 grid gap-6 sm:grid-cols-2"><div><h3 className="text-sm font-semibold">Food safety information</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{donation.safety_information || 'No additional safety information supplied.'}</p><p className="mt-3 text-xs text-muted">This information is donor reported. FoodBridge does not inspect or certify donated food.</p></div><div><h3 className="text-sm font-semibold">Description</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{donation.description || 'No additional description supplied.'}</p></div></div></section>
    <section aria-labelledby="status-heading" className="mt-5 rounded-xl border border-line bg-white p-5 sm:p-6"><h2 id="status-heading" className="text-base font-semibold">Current status</h2><div className="mt-4 flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-forest text-sm text-white">✓</span><div><p className="text-sm font-semibold">{donation.status.replace('_', ' ')}</p><p className="text-xs text-muted">Last updated {formatDate(donation.updated_at)}</p></div></div></section>
    <SuggestedMatchesSection donation={donation} onStatusChange={(status) => setDonation((current) => current ? { ...current, status } : current)} />
    {(editable || cancellable) && <div className="mt-6 flex flex-col gap-3 sm:flex-row">{editable && <Link to={`/donor/donations/${donation.id}/edit`} className="rounded-lg bg-pine px-5 py-3 text-center text-sm font-semibold text-white hover:bg-forest">Edit donation</Link>}{cancellable && <button type="button" onClick={() => void handleCancel()} disabled={cancelling} className="rounded-lg border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">{cancelling ? 'Cancelling…' : 'Cancel donation'}</button>}</div>}
  </div>
}
