import { useId, useRef, useState } from 'react'

/** Native modal supplies focus containment, an inert background, and focus return. */
export function ConfirmAction({ label, title, description, confirmLabel = label, destructive = false, disabled = false, onConfirm }: {
  label: string; title: string; description: string; confirmLabel?: string; destructive?: boolean; disabled?: boolean; onConfirm: () => Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const id = useId()
  const [busy, setBusy] = useState(false)
  async function submit() {
    if (busy) return
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false); dialog.current?.close() }
  }
  return <>
    <button type="button" disabled={disabled || busy} className={destructive ? 'button-danger' : 'button-primary'} onClick={() => { dialog.current?.showModal(); cancel.current?.focus() }}>{label}</button>
    <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={busy} onCancel={(event) => { if (busy) event.preventDefault() }} className="confirmation-dialog">
      <h2 id={`${id}-title`} className="font-display text-2xl text-ink">{title}</h2>
      <p id={`${id}-description`} className="mt-4 text-sm leading-7 text-muted">{description}</p>
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button ref={cancel} type="button" disabled={busy} onClick={() => dialog.current?.close()} className="button-secondary">Go back</button>
        <button type="button" disabled={busy} onClick={() => void submit()} className={destructive ? 'button-danger' : 'button-primary'}>{busy ? 'Saving change…' : confirmLabel}</button>
      </div>
      {busy && <p role="status" className="mt-3 text-sm text-muted">Please wait while this action is recorded.</p>}
    </dialog>
  </>
}
