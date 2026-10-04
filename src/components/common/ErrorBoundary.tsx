import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto max-w-xl p-8" role="alert">
          <h1 className="font-display text-3xl">We couldn’t load this page.</h1>
          <p className="my-4 text-muted">Please reload RescueBite and try again.</p>
          <button className="rounded-lg bg-forest px-5 py-3 text-white" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </main>
      )
    }
    return this.props.children
  }
}
