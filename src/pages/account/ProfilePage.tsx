import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/useAuth'
import { FormField, TextInput } from '../../components/auth/FormField'
import { updateProfile } from '../../services/auth/auth.service'

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [location, setLocation] = useState(profile?.location ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
      <p className="mt-4 text-sm text-muted">Update the contact details connected to your account.</p>
      <form onSubmit={submit} className="mt-8 max-w-2xl space-y-5 rounded-xl border border-line bg-white p-6 sm:p-8">
        {message && <p role="status" className="rounded-lg bg-soft px-4 py-3 text-sm text-forest">{message}</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        <FormField label="Full name" htmlFor="profile-name"><TextInput id="profile-name" value={name} onChange={(event) => setName(event.target.value)} /></FormField>
        <FormField label="Email" htmlFor="profile-email" hint="Email changes are managed through Supabase Auth."><TextInput id="profile-email" value={profile?.email ?? ''} disabled /></FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Phone" htmlFor="profile-phone"><TextInput id="profile-phone" value={phone} onChange={(event) => setPhone(event.target.value)} /></FormField>
          <FormField label="Location" htmlFor="profile-location"><TextInput id="profile-location" value={location} onChange={(event) => setLocation(event.target.value)} /></FormField>
        </div>
        <button disabled={saving} className="rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-pine disabled:opacity-60">{saving ? 'Saving…' : 'Save profile'}</button>
      </form>
    </div>
  )
}
