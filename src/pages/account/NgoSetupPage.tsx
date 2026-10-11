import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/useAuth'
import { FormField, TextInput } from '../../components/auth/FormField'
import { saveNgoProfile } from '../../services/auth/auth.service'
import { LocationPicker } from '../../components/maps/LocationPicker'
import type { Coordinates } from '../../services/location/location.types'

export default function NgoSetupPage() {
  const { user, ngoProfile, refreshProfile } = useAuth()
  const [organizationName, setOrganizationName] = useState(ngoProfile?.organization_name ?? '')
  const [description, setDescription] = useState(ngoProfile?.description ?? '')
  const [location, setLocation] = useState(ngoProfile?.location ?? '')
  const [coordinates, setCoordinates] = useState<Coordinates | null>(ngoProfile?.latitude !== null && ngoProfile?.latitude !== undefined && ngoProfile.longitude !== null ? { latitude: ngoProfile.latitude, longitude: ngoProfile.longitude } : null)
  const [capacity, setCapacity] = useState(ngoProfile?.capacity ?? 0)
  const [foodTypes, setFoodTypes] = useState(ngoProfile?.accepted_food_types.join(', ') ?? '')
  const [contact, setContact] = useState(ngoProfile?.contact_information ?? '')
  const [serviceArea, setServiceArea] = useState(ngoProfile?.service_area ?? '')
  const [registrationReference, setRegistrationReference] = useState(ngoProfile?.registration_reference ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    const acceptedFoodTypes = foodTypes.split(',').map((item) => item.trim()).filter(Boolean)
    if (!user || !organizationName.trim() || !location.trim() || capacity < 0 || !acceptedFoodTypes.length || !contact.trim()) {
      setError('Complete all required organization fields with a valid capacity.')
      return
    }
    setSaving(true)
    try {
      await saveNgoProfile(user.id, { organizationName, description, location, latitude: coordinates?.latitude ?? null, longitude: coordinates?.longitude ?? null, capacity, acceptedFoodTypes, contactInformation: contact, serviceArea, registrationReference })
      await refreshProfile()
      setMessage('Organization profile saved.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Organization profile could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">NGO account</p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl">Organization profile</h1>
      <p className="mt-3 text-sm text-forest">Verification: {ngoProfile?.verification_status?.toLowerCase() ?? 'pending'}. An administrator must verify your organization before you accept new donations.</p>
      <form onSubmit={submit} className="mt-8 grid max-w-3xl gap-5 rounded-xl border border-line bg-white p-6 sm:grid-cols-2 sm:p-8">
        {message && <p role="status" className="rounded-lg bg-soft px-4 py-3 text-sm text-forest sm:col-span-2">{message}</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 sm:col-span-2">{error}</p>}
        <FormField label="Organization name" htmlFor="ngo-name"><TextInput id="ngo-name" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} /></FormField>
        <FormField label="Location" htmlFor="ngo-location"><TextInput id="ngo-location" value={location} onChange={(event) => setLocation(event.target.value)} /></FormField>
        <div className="sm:col-span-2"><LocationPicker value={coordinates} onChange={setCoordinates} label="Organization destination position" /></div>
        <FormField label="Receiving capacity" htmlFor="ngo-capacity" hint="Approximate meal portions"><TextInput id="ngo-capacity" type="number" min="0" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></FormField>
        <FormField label="Contact information" htmlFor="ngo-contact"><TextInput id="ngo-contact" value={contact} onChange={(event) => setContact(event.target.value)} /></FormField>
        <FormField label="Accepted food types" htmlFor="ngo-food-types" hint="Separate values with commas"><TextInput id="ngo-food-types" value={foodTypes} onChange={(event) => setFoodTypes(event.target.value)} /></FormField>
        <FormField label="Description" htmlFor="ngo-description" hint="Optional"><TextInput id="ngo-description" value={description} onChange={(event) => setDescription(event.target.value)} /></FormField>
        <FormField label="Service area" htmlFor="ngo-service-area"><TextInput id="ngo-service-area" value={serviceArea} onChange={(event) => setServiceArea(event.target.value)} /></FormField>
        <FormField label="Registration reference" htmlFor="ngo-registration-reference" hint="Optional; reviewed by an administrator"><TextInput id="ngo-registration-reference" value={registrationReference} onChange={(event) => setRegistrationReference(event.target.value)} /></FormField>
        <div className="sm:col-span-2"><button disabled={saving} className="rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-pine disabled:opacity-60">{saving ? 'Saving…' : 'Save organization profile'}</button></div>
      </form>
    </div>
  )
}
