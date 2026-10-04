import { cloneElement, isValidElement, type InputHTMLAttributes, type ReactNode } from 'react'

export function FormField({ label, error, hint, children, htmlFor, required = false }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor: string; required?: boolean }) {
  const describedBy = [hint && `${htmlFor}-hint`, error && `${htmlFor}-error`].filter(Boolean).join(' ') || undefined
  const control = isValidElement<InputHTMLAttributes<HTMLInputElement>>(children) ? cloneElement(children, {
    'aria-describedby': [children.props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
    'aria-required': required || undefined,
    'aria-invalid': Boolean(error),
  }) : children
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-ink">{label}{required && <span className="ml-1 text-xs font-normal text-muted">(required)</span>}</label>
      {control}
      {hint && <p id={`${htmlFor}-hint`} className="mt-2 text-xs leading-5 text-muted">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} role="alert" className="mt-2 text-xs font-medium text-red-700">{error}</p>}
    </div>
  )
}

export function TextInput({ error, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return <input {...props} aria-invalid={Boolean(error) || props['aria-invalid']} aria-describedby={props['aria-describedby'] ?? (error ? `${props.id}-error` : undefined)} className={`w-full rounded-lg border bg-white px-4 py-3 text-sm text-ink shadow-sm transition placeholder:text-muted focus:border-forest ${error ? 'border-red-400' : 'border-line'} ${className}`} />
}
