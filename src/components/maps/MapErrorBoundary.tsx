import { Component, type ErrorInfo, type ReactNode } from 'react'

export class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Map rendering failed', error, info) }

  render() {
    if (this.state.failed) return <div role="alert" className="grid min-h-64 place-items-center rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">The map could not be displayed. Your written location remains available.</div>
    return this.props.children
  }
}
