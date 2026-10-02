import { useState, type FormEvent } from 'react'
import { FormField, TextInput } from '../auth/FormField'
import { EMPTY_DONATION_INPUT, FOOD_TYPES, type DonationFieldErrors, type DonationInput } from '../../services/donations/donation.types'
import { hasDonationErrors, validateDonation } from '../../services/donations/donation.validation'
import { LocationPicker } from '../maps/LocationPicker'

const inputClass = 'w-full rounded-lg border border-line bg-white px-4 py-3 text-sm text-ink shadow-sm focus:border-forest focus:outline-none'

export function DonationForm({ initialValue = EMPTY_DONATION_INPUT, submitLabel, isSubmitting, serverError, onSubmit }: {
  initialValue?: DonationInput; submitLabel: string; isSubmitting: boolean; serverError?: string | null
  onSubmit: (input: DonationInput) => Promise<void>
}) {
  const [input, setInput] = useState(initialValue)
  const [errors, setErrors] = useState<DonationFieldErrors>({})
  function set<K extends keyof DonationInput>(key: K, value: DonationInput[K]) { setInput((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })) }
  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors = validateDonation(input)
    setErrors(nextErrors)
    if (!hasDonationErrors(nextErrors)) await onSubmit(input)
  }
  return <form onSubmit={(event) => void handleSubmit(event)} noValidate className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-8">
    {serverError && <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{serverError}</div>}
    <div className="grid gap-6 md:grid-cols-2">
      <FormField label="Food type" htmlFor="foodType" error={errors.foodType} hint="Choose the closest practical category."><select id="foodType" value={input.foodType} onChange={(e) => set('foodType', e.target.value as DonationInput['foodType'])} aria-invalid={Boolean(errors.foodType)} className={inputClass}><option value="">Select a food type</option>{FOOD_TYPES.map((type) => <option key={type}>{type}</option>)}</select></FormField>
      {input.foodType === 'Other' && <FormField label="Other food type" htmlFor="otherFoodType" error={errors.otherFoodType}><TextInput id="otherFoodType" value={input.otherFoodType} onChange={(e) => set('otherFoodType', e.target.value)} error={errors.otherFoodType} placeholder="For example, dairy products" /></FormField>}
      <FormField label="Quantity" htmlFor="quantity" error={errors.quantity} hint="Enter the total amount using the practical measure described below."><TextInput id="quantity" type="number" min="0.01" step="0.01" value={input.quantity || ''} onChange={(e) => set('quantity', e.target.valueAsNumber)} error={errors.quantity} /></FormField>
      <FormField label="Meal portions" htmlFor="mealPortions" error={errors.mealPortions} hint="Estimate how many people this food can serve."><TextInput id="mealPortions" type="number" min="1" step="1" value={input.mealPortions || ''} onChange={(e) => set('mealPortions', e.target.valueAsNumber)} error={errors.mealPortions} /></FormField>
      <div className="md:col-span-2"><FormField label="Pickup location" htmlFor="location" error={errors.location} hint="Give an address or clear collection point, then optionally confirm the exact map position."><TextInput id="location" value={input.location} onChange={(e) => set('location', e.target.value)} error={errors.location} autoComplete="street-address" /></FormField></div>
      <div className="md:col-span-2"><LocationPicker value={input.latitude !== null && input.longitude !== null ? { latitude: input.latitude, longitude: input.longitude } : null} onChange={(coordinates) => { set('latitude', coordinates?.latitude ?? null); set('longitude', coordinates?.longitude ?? null) }} label="Donation pickup position" />{errors.latitude && <p role="alert" className="mt-2 text-xs text-red-700">{errors.latitude}</p>}</div>
      <FormField label="Available from" htmlFor="availableFrom" error={errors.availableFrom}><TextInput id="availableFrom" type="datetime-local" value={input.availableFrom} onChange={(e) => set('availableFrom', e.target.value)} error={errors.availableFrom} /></FormField>
      <FormField label="Collection deadline" htmlFor="collectionDeadline" error={errors.collectionDeadline}><TextInput id="collectionDeadline" type="datetime-local" value={input.collectionDeadline} onChange={(e) => set('collectionDeadline', e.target.value)} error={errors.collectionDeadline} /></FormField>
      <div className="md:col-span-2"><FormField label="Food safety information" htmlFor="safetyInformation" hint="Report preparation time, storage, covering, and handling details. FoodBridge does not inspect or certify donated food."><textarea id="safetyInformation" rows={4} value={input.safetyInformation} onChange={(e) => set('safetyInformation', e.target.value)} className={inputClass} /></FormField></div>
      <div className="md:col-span-2"><FormField label="Description" htmlFor="description" hint="Add useful details about the food or collection instructions."><textarea id="description" rows={4} value={input.description} onChange={(e) => set('description', e.target.value)} className={inputClass} /></FormField></div>
    </div>
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end"><button type="submit" disabled={isSubmitting} className="rounded-lg bg-pine px-6 py-3 text-sm font-semibold text-white hover:bg-forest disabled:cursor-wait disabled:opacity-60">{isSubmitting ? 'Saving donation…' : submitLabel}</button></div>
  </form>
}
