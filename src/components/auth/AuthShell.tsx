import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,0.88fr)_minmax(520px,1.12fr)]">
      <aside className="relative hidden overflow-hidden bg-pine p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden="true" className="absolute -top-24 -right-20 size-96 rounded-full border-[70px] border-white/5" />
        <Link to="/" className="relative flex items-center gap-3" aria-label="FoodBridge home">
          <span className="grid size-11 place-items-center rounded-xl bg-lime text-pine">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M19 4C8 3 3 8 6 15c7 4 13-1 13-11Z" /><path d="M4 21 15 10" /></svg>
          </span>
          <span className="font-display text-2xl">FoodBridge</span>
        </Link>
        <div className="relative my-auto max-w-lg py-16">
          <p className="text-xs font-semibold tracking-[0.18em] text-lime uppercase">A shared rescue network</p>
          <blockquote className="mt-6 font-display text-5xl leading-[1.12]">Good food deserves somewhere to go.</blockquote>
          <p className="mt-7 max-w-md text-sm leading-7 text-white/65">One secure account connects donors, receiving organizations, volunteers, and platform administrators.</p>
        </div>
        <p className="relative text-xs text-white/45">Food Rescue & Surplus Redistribution Platform</p>
      </aside>
      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-xl">
          <Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-pine lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-lime">↗</span> FoodBridge
          </Link>
          <p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">{eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-muted">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
