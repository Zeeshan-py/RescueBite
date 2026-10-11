import { Icon } from './Icon'
import './feedback.css'

export function LoadingState({ label = 'Loading RescueBite…', fullScreen = false, compact = false }: { label?: string; fullScreen?: boolean; compact?: boolean }) {
  return <div className={`feedback-loading${fullScreen ? ' feedback-fullscreen' : ''}${compact ? ' feedback-compact' : ''}`} role="status" aria-live="polite" aria-atomic="true">
    <div className="feedback-loader-art" aria-hidden="true"><span className="feedback-loader-ring" /><span className="feedback-loader-leaf"><Icon name="leaf" width="32" height="32" /></span><span className="feedback-loader-dot" /></div>
    <div><p className="feedback-loading-label">{label}</p>{!compact && <p className="feedback-loading-note">A moment closer to sharing something good.</p>}</div>
    {!compact && <div className="feedback-loading-track" aria-hidden="true"><span /></div>}
  </div>
}
