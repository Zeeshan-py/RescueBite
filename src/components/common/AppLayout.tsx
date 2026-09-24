import { useState, type ReactNode } from 'react'

const futureSections = ['Food donations', 'Smart matching', 'Pickups & delivery', 'NGOs & partners', 'Impact reports']

export function AppLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[252px_1fr]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">
        Skip to content
      </a>
      <aside className="bg-pine text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-6 sm:px-6">
          <a href="#overview" className="flex items-center gap-3" aria-label="FoodBridge overview" onClick={() => setMenuOpen(false)}>
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-lime text-pine">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M19 4C8 3 3 8 6 15c7 4 13-1 13-11Z" /><path d="M4 21 15 10" /></svg>
            </span>
            <span><span className="block font-display text-2xl">FoodBridge</span><span className="text-[11px] text-white/65">Surplus food. Shared purpose.</span></span>
          </a>
          <button className="rounded-lg border border-white/30 px-3 py-2 text-sm lg:hidden" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        <nav id="main-navigation" aria-label="Main navigation" className={`${menuOpen ? 'block' : 'hidden'} px-4 py-7 lg:block`}>
          <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.2em] text-white/55 uppercase">Workspace</p>
          <a href="#overview" aria-current="page" onClick={() => setMenuOpen(false)} className="mb-2 flex items-center gap-3 rounded-lg bg-white/10 px-3 py-3 text-sm font-medium">
            <span aria-hidden="true">▦</span> Overview
          </a>
          {futureSections.map((label) => (
            <button key={label} disabled className="flex w-full cursor-not-allowed items-center justify-between gap-2 px-3 py-3 text-left text-sm text-white/55">
              {label}<span className="text-[9px] uppercase">Soon</span>
            </button>
          ))}
          <p className="mt-5 px-3 text-xs leading-5 text-white/60">These areas will become available as the platform is developed.</p>
        </nav>
        <div className="mt-auto hidden border-t border-white/10 p-6 lg:block">
          <p className="text-sm text-lime">A little less waste.<br />A little more possibility.</p>
          <p className="mt-4 text-[11px] text-white/50">Food Rescue & Redistribution</p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-4 border-b border-line bg-white px-5 py-5 sm:px-10">
          <p className="text-sm text-muted">Workspace <span aria-hidden="true" className="mx-2 text-line">/</span> <span className="text-ink">Overview</span></p>
          <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">Foundation preview</span>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-8 sm:px-10 sm:py-12">{children}</main>
        <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-5 pb-6 text-xs text-muted sm:px-10">
          <span>FoodBridge · Food Rescue & Surplus Redistribution</span><span>SE Lab · Phase 1</span>
        </footer>
      </div>
    </div>
  )
}
