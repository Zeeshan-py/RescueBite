export default function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return <div><p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Phase 3 placeholder</p><h1 className="mt-3 font-display text-4xl sm:text-5xl">{title}</h1><div className="mt-7 max-w-2xl rounded-xl border border-line bg-white p-6"><p className="text-sm leading-7 text-muted">{description}</p><p className="mt-4 text-xs font-semibold text-forest">Authentication and role protection are active. Business functionality will be added in a later phase.</p></div></div>
}
