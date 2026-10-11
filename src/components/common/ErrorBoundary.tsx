import { Component, type ReactNode } from 'react'
import { ErrorState } from './ErrorState'

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return <main><ErrorState fullScreen title="We couldn’t open this page." message="Something interrupted the page. Reload to try again, or head back to the overview." onRetry={() => window.location.reload()} retryLabel="Reload page" actions={<a className="button-secondary" href="/">Back to overview</a>} /></main>
    return this.props.children
  }
}
