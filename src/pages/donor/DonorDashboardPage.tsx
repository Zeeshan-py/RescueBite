import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { LoadingState } from '../../components/common/LoadingState'
import { getMyDonations } from '../../services/donations/donation.service'
import type { Donation } from '../../types/domain'

export default function DonorDashboardPage() {
  const { profile } = useAuth()
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { void getMyDonations().then(setDonations).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)) }, [])
  const stats = useMemo(() => ({
    active: donations.filter((d) => !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(d.status)).length,
    posted: donations.filter((d) => d.status === 'POSTED').length,
    completed: donations.filter((d) => d.status === 'COMPLETED').length,
    closed: donations.filter((d) => ['CANCELLED', 'EXPIRED'].includes(d.status)).length,
    portions: donations.filter((d) => d.status !== 'CANCELLED').reduce((sum, d) => sum + d.meal_portions, 0),
  }), [donations])
  if (loading) return <LoadingState label="Loading your donation summary…" />
  return <div><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Donor workspace</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">Hello, {profile?.name?.split(' ')[0] ?? 'there'}.</h1><p className="mt-3 text-sm leading-7 text-muted">Share surplus food and follow every donation from posting to completion.</p></div><Link to="/donor/donations/new" className="rounded-lg bg-pine px-5 py-3 text-center text-sm font-semibold text-white hover:bg-forest">Create donation</Link></div>
    {error && <p role="alert" className="mt-7 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {!error && donations.length === 0 ? <div className="mt-10 rounded-2xl border border-dashed border-forest/30 bg-white p-8 text-center sm:p-12"><h2 className="font-display text-3xl">No donations yet</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">You haven&apos;t created any food donations yet. Your first post can connect surplus food with people who need it.</p><Link to="/donor/donations/new" className="mt-6 inline-flex rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white">Create Donation</Link></div> : !error && <><div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[['Active', stats.active], ['Posted', stats.posted], ['Completed', stats.completed], ['Cancelled / expired', stats.closed], ['Meal portions', stats.portions]].map(([label, value]) => <div key={label} className="rounded-xl border border-line bg-white p-5"><p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p><p className="mt-3 font-display text-4xl text-pine">{value}</p></div>)}</div><Link to="/donor/donations" className="mt-7 inline-flex text-sm font-semibold text-forest hover:underline">View all donations →</Link></>}
  </div>
}

