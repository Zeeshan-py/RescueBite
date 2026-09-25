import { Link } from 'react-router-dom'
import { supabaseConfigurationError } from '../lib/supabase'

const roles = [
  { name: 'Donors', description: 'Give surplus food a second purpose.', detail: 'Share food availability and follow its journey.' },
  { name: 'NGOs & charities', description: 'Connect food with community needs.', detail: 'Review suitable donations and confirm receipt.' },
  { name: 'Volunteers', description: 'Make the connection happen.', detail: 'Help collect food and deliver it to an NGO.' },
  { name: 'Administrators', description: 'Keep every rescue accountable.', detail: 'Oversee participants, activity, and exceptions.' },
]

const steps = ['Donor creates donation', 'Smart matching', 'NGO accepts', 'Volunteer pickup', 'Food collected', 'Food delivered', 'NGO confirms receipt', 'Donation completed', 'Impact recorded']

export default function OverviewPage() {
  return (
    <div id="overview">
      <div className="mb-7 flex items-center gap-2 text-xs font-medium text-forest"><span className="size-2 rounded-full bg-forest" /> Building a more connected food community</div>
      <section className="relative overflow-hidden rounded-2xl border border-line bg-soft px-6 py-9 sm:px-10 sm:py-12" aria-labelledby="welcome-heading">
        <div aria-hidden="true" className="pointer-events-none absolute -top-12 -right-16 size-64 rounded-full border-[40px] border-forest/5" />
        <p className="relative text-xs font-semibold tracking-[0.16em] text-forest uppercase">Welcome to FoodBridge</p>
        <h1 id="welcome-heading" className="relative mt-4 max-w-xl font-display text-4xl leading-[1.15] tracking-tight sm:text-5xl">Good food deserves<br />somewhere to go.</h1>
        <p className="relative mt-5 max-w-lg text-sm leading-7 text-muted">Connecting donors, NGOs, and volunteers to help surplus food reach the communities that need it.</p>
        <div className="relative mt-7 flex flex-wrap gap-3"><Link to="/register" className="inline-flex items-center gap-5 rounded-lg bg-forest px-5 py-3 text-sm font-medium text-white hover:bg-pine">Create an account <span aria-hidden="true">→</span></Link><Link to="/login" className="inline-flex items-center rounded-lg border border-forest/25 bg-white/60 px-5 py-3 text-sm font-semibold text-forest hover:bg-white">Sign in</Link></div>
      </section>

      <div className="my-6 flex flex-col gap-2 rounded-xl border border-line bg-white px-5 py-4 sm:flex-row sm:gap-5">
        <span className="shrink-0 text-sm font-semibold text-forest">Account access is ready</span>
        <p className="text-sm leading-6 text-muted">Donors, NGOs, and volunteers can register securely and enter a role-protected workspace.</p>
      </div>

      <section aria-labelledby="community-heading" className="mt-10">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><h2 id="community-heading" className="font-display text-2xl">One purpose. Four ways to help.</h2><span className="text-xs text-muted">Planned workspaces</span></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {roles.map((role, index) => (
            <article key={role.name} className="rounded-xl border border-line bg-white p-5">
              <span aria-hidden="true" className="font-display text-2xl text-forest/60">0{index + 1}</span>
              <h3 className="mt-5 text-sm font-semibold">{role.name}</h3>
              <p className="mt-2 text-sm leading-6">{role.description}</p>
              <p className="mt-3 text-xs leading-5 text-muted">{role.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="rescue-journey" aria-labelledby="journey-heading" className="mt-10 scroll-mt-6 rounded-xl border border-line bg-white p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-widest text-forest uppercase">From surplus to support</p>
        <h2 id="journey-heading" className="mt-2 font-display text-2xl">Every rescue has a journey.</h2>
        <p className="mt-2 text-sm leading-6 text-muted">The planned workflow follows each donation through to confirmed receipt.</p>
        <ol className="mt-7 grid gap-x-8 gap-y-5 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-3 text-sm"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-soft text-xs font-semibold text-forest">{index + 1}</span>{step}</li>
          ))}
        </ol>
      </section>

      <details className="my-8 rounded-lg border border-line px-5 py-4 text-xs text-muted">
        <summary className="cursor-pointer font-medium text-ink">Development setup</summary>
        <p className="mt-3 leading-6">{supabaseConfigurationError ?? 'Supabase authentication and protected profile access are configured.'}</p>
      </details>
    </div>
  )
}
