import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LoadingState } from '../../components/common/LoadingState'
import { DonationForm } from '../../components/donations/DonationForm'
import { createDonation, getDonationById, updateDonation } from '../../services/donations/donation.service'
import { EMPTY_DONATION_INPUT, type DonationInput, type FoodTypeOption } from '../../services/donations/donation.types'

const localDateTime = (value: string) => { const date = new Date(value); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16) }
function toInput(donation: Awaited<ReturnType<typeof getDonationById>>): DonationInput {
  const isOther = donation.food_type.startsWith('Other: ')
  return { foodType: isOther ? 'Other' : donation.food_type as FoodTypeOption, otherFoodType: isOther ? donation.food_type.slice(7) : '', quantity: donation.quantity, mealPortions: donation.meal_portions, location: donation.location, latitude: donation.latitude, longitude: donation.longitude, availableFrom: localDateTime(donation.available_from), collectionDeadline: localDateTime(donation.collection_deadline), safetyInformation: donation.safety_information ?? '', description: donation.description ?? '' }
}

export default function DonationFormPage() {
  const { id } = useParams(), navigate = useNavigate(), editing = Boolean(id)
  const [initial, setInitial] = useState<DonationInput>(EMPTY_DONATION_INPUT), [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null)
  useEffect(() => { if (!id) return; void getDonationById(id).then((donation) => { if (donation.status !== 'POSTED') throw new Error('This donation can no longer be edited.'); setInitial(toInput(donation)) }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)) }, [id])
  async function submit(input: DonationInput) { setSaving(true); setError(null); try { const donation = id ? await updateDonation(id, input) : await createDonation(input); navigate(`/donor/donations/${donation.id}`, { replace: true, state: { message: editing ? 'Donation updated successfully.' : 'Donation posted successfully.' } }) } catch (e) { setError(e instanceof Error ? e.message : 'The donation could not be saved.') } finally { setSaving(false) } }
  if (loading) return <LoadingState label="Loading donation…" />
  return <div><Link to={id ? `/donor/donations/${id}` : '/donor/donations'} className="text-sm font-semibold text-forest hover:underline">← Back to donations</Link><h1 className="mt-8 font-display text-4xl sm:text-5xl">{editing ? 'Edit donation' : 'Post a donation'}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted">Add accurate food and pickup details so an NGO can decide whether to accept it.</p>{error && editing && initial === EMPTY_DONATION_INPUT ? <p role="alert" className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : <DonationForm key={id ?? 'new'} initialValue={initial} submitLabel={editing ? 'Save changes' : 'Post donation'} isSubmitting={saving} serverError={error} onSubmit={submit} />}</div>
}
