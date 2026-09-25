import type { InputHTMLAttributes, ReactNode } from 'react'

export function FormField({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-ink">{label}</label>
      {children}
      {error ? <p id={`${htmlFor}-error`} role="alert" className="mt-2 text-xs font-medium text-red-700">{error}</p> : hint ? <p className="mt-2 text-xs leading-5 text-muted">{hint}</p> : null}
    </div>
  )
}

export function TextInput({ error, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return <input {...props} aria-invalid={Boolean(error)} aria-describedby={error ? `${props.id}-error` : undefined} className={`w-full rounded-lg border bg-white px-4 py-3 text-sm text-ink shadow-sm transition placeholder:text-muted/65 focus:border-forest focus:outline-none ${error ? 'border-red-400' : 'border-line'} ${className}`} />
}
