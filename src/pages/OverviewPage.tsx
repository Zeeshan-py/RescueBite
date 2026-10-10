import { Link } from 'react-router-dom'

const steps = [
  { title: 'Post a donation', detail: 'Share food type, portions, pickup location, and collection deadline.' },
  { title: 'Choose who can receive', detail: 'Offer meals to verified NGOs, individual recipients, or both.' },
  { title: 'Arrange collection', detail: 'An NGO accepts or a donor approves an individual request. The recipient collects and confirms receipt.' },
]

export default function OverviewPage() {
  return <div id="overview">
    <section className="overview-hero rounded-2xl border border-line bg-soft px-6 py-10 sm:px-10 sm:py-14" aria-labelledby="welcome-heading">
      <p className="overview-eyebrow text-xs font-semibold tracking-[0.16em] text-forest uppercase">Food rescue, coordinated</p>
      <h1 id="welcome-heading" className="mt-4 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">Move surplus food to the people who need it.</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-muted">Connect food providers with verified NGOs and individuals who can collect surplus meals.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/register" className="inline-flex min-h-11 items-center rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-pine">Create an account</Link>
        <Link to="/login" className="inline-flex min-h-11 items-center rounded-lg border border-forest/25 bg-white px-5 py-3 text-sm font-semibold text-forest hover:bg-soft">Sign in</Link>
      </div>
    </section>

    <section id="rescue-journey" aria-labelledby="journey-heading" className="mt-10 scroll-mt-6">
      <h2 id="journey-heading" className="font-display text-2xl">How it works</h2>
      <ol className="mt-5 grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => <li key={step.title} className="rounded-xl border border-line bg-white p-6">
          <span className="text-sm font-semibold text-forest">0{index + 1}</span>
          <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">{step.detail}</p>
        </li>)}
      </ol>
      <p className="mt-5 text-sm text-muted">Pickup is arranged directly with the accepted recipient. Every handover is recorded.</p>
    </section>
  </div>
}
