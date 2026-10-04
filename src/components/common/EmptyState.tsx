import type { ReactNode } from 'react'

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-forest/30 bg-white p-6 text-center sm:p-8">
    <p className="font-semibold text-ink">{title}</p>
    {description && <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
}
