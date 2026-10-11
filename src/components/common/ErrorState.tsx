import type { ReactNode } from 'react'
import { Icon } from './Icon'
import './feedback.css'

export function ErrorState({ title = 'Let’s try that again.', message = 'We couldn’t load this information. Check your connection and try again.', onRetry, retryLabel = 'Try again', actions, fullScreen = false, kind = 'error' }: {
  title?: string; message?: string; onRetry?: () => void; retryLabel?: string; actions?: ReactNode; fullScreen?: boolean; kind?: 'error' | 'missing' | 'access'
}) {
  const Heading = fullScreen ? 'h1' : 'h2'
  return <section className={`feedback-error${fullScreen ? ' feedback-fullscreen' : ''}`}>
    <div className="feedback-error-card">
      <div className={`feedback-error-art feedback-art-${kind}`} aria-hidden="true"><span className="feedback-error-orbit" /><span className="feedback-error-symbol"><Icon name={kind === 'missing' ? 'location' : kind === 'access' ? 'shield' : 'leaf'} width="42" height="42" /></span><span className="feedback-error-marker">{kind === 'missing' ? '?' : '!'}</span><span className="feedback-error-seed" /></div>
      <div role="alert" aria-atomic="true"><p className="feedback-eyebrow">{kind === 'missing' ? 'A little off the path' : kind === 'access' ? 'Account access' : 'A small pause in the journey'}</p><Heading>{title}</Heading><p className="feedback-error-message">{message}</p></div>
      {(onRetry || actions) && <div className="feedback-actions">{onRetry && <button type="button" className="button-primary" onClick={onRetry}><Icon name="refresh" width="17" />{retryLabel}</button>}{actions}</div>}
    </div>
  </section>
}

export function ErrorNotice({ message }: { message: string }) {
  return <div className="feedback-notice" role="alert"><span aria-hidden="true">!</span><p>{message}</p></div>
}
