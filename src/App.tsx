import { lazy, Suspense } from 'react'
import { AppLayout } from './components/common/AppLayout'
import { LoadingState } from './components/common/LoadingState'

const OverviewPage = lazy(() => import('./pages/OverviewPage'))

export default function App() {
  return (
    <AppLayout>
      <Suspense fallback={<LoadingState />}><OverviewPage /></Suspense>
    </AppLayout>
  )
}
