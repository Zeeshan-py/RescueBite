import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/useAuth'
import { FormField, TextInput } from '../../components/auth/FormField'
import { updateProfile } from '../../services/auth/auth.service'
import { getBusinessProfile, getProfileVerification, saveBusinessProfile, type DonorBusinessProfile, type ProfileVerification } from '../../services/auth/business-profile.service'

const emptyBusiness = (userId: string): DonorBusinessProfile => ({ user_id: userId, business_name: '', business_type: 'RESTAURANT', pickup_address: '', general_area: '', pickup_hours: '', description: '', latitude: null, longitude: null })

export default function ProfilePage() {
  const { user, profile, role, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [location, setLocation] = useState(profile?.location ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [business, setBusiness] = useState<DonorBusinessProfile | null>(null)
  const [verification, setVerification] = useState<ProfileVerification | null>(null)
  useEffect(() => {
    if (!user) return
    let active = true
    void Promise.all([getProfileVerification(),role==='DONOR' ? getBusinessProfile(user.id) : Promise.resolve(null)])
      .then(([nextVerification,nextBusiness]) => { if (active) { setVerification(nextVerification); if (role==='DONOR') setBusiness(nextBusiness ?? emptyBusiness(user.id)) } })
      .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : 'Profile details unavailable.') })
    return () => { active=false }
  }, [user,role])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    if (!user || !name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    try {
      await updateProfile(user.id, { name, phone, location })
      await refreshProfile()
      setMessage('Profile updated successfully.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Profile update failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Account</p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl">Your profile</h1>
      <p className="mt-4 text-sm text-muted">Update your contact details. Your optional mobile number is shared with participants in an accepted donation and administrators.</p>
      <form onSubmit={submit} className="mt-8 max-w-2xl space-y-5 rounded-xl border border-line bg-white p-6 sm:p-8">
        {message && <p role="status" className="rounded-lg bg-soft px-4 py-3 text-sm text-forest">{message}</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        <FormField label="Full name" htmlFor="profile-name"><TextInput id="profile-name" value={name} onChange={(event) => setName(event.target.value)} /></FormField>
        <FormField label="Email" htmlFor="profile-email" hint="Email changes are managed through Supabase Auth."><TextInput id="profile-email" value={profile?.email ?? ''} disabled /></FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Mobile number" htmlFor="profile-phone" hint="Optional · 7–15 digits, with country code when possible"><TextInput id="profile-phone" type="tel" autoComplete="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} /></FormField>
          <FormField label="Location" htmlFor="profile-location"><TextInput id="profile-location" value={location} onChange={(event) => setLocation(event.target.value)} /></FormField>
        </div>
        <button disabled={saving} className="rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-pine disabled:opacity-60">{saving ? 'Saving…' : 'Save profile'}</button>
      </form>
      {role==='DONOR' && business && <section className="mt-6 max-w-2xl rounded-xl border border-line bg-white p-6 sm:p-8"><h2 className="text-xl font-semibold">Business and pickup profile</h2><p className="mt-2 text-sm text-muted">Your pickup address and contact details are shared only with an accepted recipient.</p><form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); if (!business.business_name.trim() || !business.pickup_address.trim() || !business.general_area.trim() || !business.pickup_hours.trim()) { setError('Complete all required business fields.'); return } setSaving(true); setError(null); void saveBusinessProfile(business).then(() => setMessage('Business profile saved.')).catch(caught => setError(caught.message)).finally(() => setSaving(false)) }}>
        {([['business_name','Business name'],['pickup_address','Pickup address'],['general_area','General area'],['pickup_hours','Pickup hours']] as const).map(([key,label]) => <label key={key} className="text-sm font-medium">{label}<input required maxLength={key==='pickup_address'?1000:300} value={business[key]} onChange={event => setBusiness({...business,[key]:event.target.value})} className="mt-2 w-full rounded-lg border border-line p-3" /></label>)}
        <label className="text-sm font-medium">Business type<select value={business.business_type} onChange={event => setBusiness({...business,business_type:event.target.value as DonorBusinessProfile['business_type']})} className="mt-2 w-full rounded-lg border border-line p-3">{['RESTAURANT','BAKERY','CATERER','GROCERY','OTHER'].map(type=><option key={type}>{type}</option>)}</select></label>
        <label className="text-sm font-medium">Public description (optional)<textarea maxLength={2000} value={business.description??''} onChange={event => setBusiness({...business,description:event.target.value})} className="mt-2 w-full rounded-lg border border-line p-3" /></label>
        <button disabled={saving} className="min-h-11 rounded-lg bg-forest px-5 text-white sm:col-span-2">Save business profile</button></form>
        <p className="mt-7 border-t border-line pt-5 text-sm text-muted">{verification?.email_verified ? 'Email confirmed.' : 'Confirm your email to post donations.'} Mobile contact is optional and does not require a text message.</p>
      </section>}
    </div>
  )
}
