import { ErrorState } from '../common/ErrorState'
import { Component, type ErrorInfo, type ReactNode } from 'react'

export class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Map rendering failed', error, info) }

  render() {
    if (this.state.failed) return <ErrorState title="The map took a detour." message="The map could not be displayed. Your written location remains available." onRetry={() => this.setState({ failed: false })} />
    return this.props.children
  }
}
