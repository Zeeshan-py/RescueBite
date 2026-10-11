import { useState, type InputHTMLAttributes } from 'react'
import { TextInput } from './FormField'

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  const [visible, setVisible] = useState(false)
  return <div className="auth-password">
    <TextInput {...props} type={visible ? 'text' : 'password'} />
    <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} aria-controls={props.id} disabled={props.disabled} onClick={() => setVisible(previous => !previous)}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visible && <path d="m3 3 18 18" />}</svg>
    </button>
  </div>
}
