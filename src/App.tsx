import { ErrorState } from './components/common/ErrorState'
import { lazy, Suspense, type ReactNode } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute'
import { roleHomePath } from './auth/route-access'
import { useAuth } from './auth/useAuth'
import { AppLayout } from './components/common/AppLayout'
import { LoadingState } from './components/common/LoadingState'
import type { UserRole } from './types/domain'

const OverviewPage = lazy(() => import('./pages/OverviewPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const GoogleCallbackPage = lazy(() => import('./pages/auth/GoogleCallbackPage'))
const InformationPage = lazy(() => import('./pages/public/InformationPage'))
const AnalyticsPage = lazy(() => import('./pages/analytics/AnalyticsPage'))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const AdminRecordsPage = lazy(() => import('./pages/admin/AdminRecordsPage'))
const ProfilePage = lazy(() => import('./pages/account/ProfilePage'))
const NgoSetupPage = lazy(() => import('./pages/account/NgoSetupPage'))
const AccountUnavailablePage = lazy(() => import('./pages/account/AccountUnavailablePage'))
const DonorDashboardPage = lazy(() => import('./pages/donor/DonorDashboardPage'))
const DonationListPage = lazy(() => import('./pages/donor/DonationListPage'))
const DonationFormPage = lazy(() => import('./pages/donor/DonationFormPage'))
const DonationDetailsPage = lazy(() => import('./pages/donor/DonationDetailsPage'))
const NgoDashboardPage = lazy(() => import('./pages/ngo/NgoDashboardPage'))
const NgoDonationListPage = lazy(() => import('./pages/ngo/NgoDonationListPage'))
const NgoDonationDetailsPage = lazy(() => import('./pages/ngo/NgoDonationDetailsPage'))
const RecipientPage = lazy(() => import('./pages/recipient/RecipientPage'))
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'))

const allRoles: UserRole[] = ['DONOR', 'NGO', 'RECIPIENT', 'ADMIN']

function Page({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <Suspense fallback={<LoadingState label="Opening your next page…" />}><div key={pathname} className="route-arrival">{children}</div></Suspense>
}

function HomeRoute() {
  const { isLoading, isAuthenticated, role, profile } = useAuth()
  if (isLoading) return <LoadingState label="Loading application…" fullScreen />
  if (isAuthenticated && profile?.account_status !== 'ACTIVE') return <Navigate to="/account-unavailable" replace />
  if (isAuthenticated && role) return <Navigate to={roleHomePath[role]} replace />
  return <AppLayout><Page><OverviewPage /></Page></AppLayout>
}

function AuthenticatedLayout() {
  return <AppLayout><Outlet /></AppLayout>
}

function UnknownRoute() {
  const { role } = useAuth()
  return <main><ErrorState fullScreen kind="missing" title="This page wandered off." message="The link may have changed, or the address may be incomplete. Let’s get you back to your next food rescue." actions={<Link className="button-primary" to={role ? roleHomePath[role] : '/'}>{role ? 'Back to workspace' : 'Back to overview'}</Link>} /></main>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      {(['about', 'faq', 'contact', 'terms', 'privacy', 'food-safety'] as const).map((page) => <Route key={page} path={`/${page}`} element={<Page><InformationPage page={page} /></Page>} />)}
      <Route path="/auth/google/callback" element={<Page><GoogleCallbackPage /></Page>} />
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Page><LoginPage /></Page>} />
        <Route path="/register" element={<Page><RegisterPage /></Page>} />
      </Route>
      <Route path="/account-unavailable" element={<Page><AccountUnavailablePage /></Page>} />

      <Route element={<ProtectedRoute allowedRoles={allRoles} />}>
        <Route element={<AuthenticatedLayout />}>
          <Route path="/profile" element={<Page><ProfilePage /></Page>} />
          <Route path="/notifications" element={<Page><NotificationsPage /></Page>} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['DONOR']} />}>
        <Route element={<AuthenticatedLayout />}>
          <Route path="/donor/analytics" element={<Page><AnalyticsPage /></Page>} />
          <Route path="/donor" element={<Page><DonorDashboardPage /></Page>} />
          <Route path="/donor/donations" element={<Page><DonationListPage /></Page>} />
          <Route path="/donor/donations/new" element={<Page><DonationFormPage /></Page>} />
          <Route path="/donor/donations/:id" element={<Page><DonationDetailsPage /></Page>} />
          <Route path="/donor/donations/:id/edit" element={<Page><DonationFormPage /></Page>} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['NGO']} />}>
        <Route element={<AuthenticatedLayout />}>
          <Route path="/ngo/analytics" element={<Page><AnalyticsPage /></Page>} />
          <Route path="/ngo" element={<Page><NgoDashboardPage /></Page>} />
          <Route path="/ngo/setup" element={<Page><NgoSetupPage /></Page>} />
          <Route path="/ngo/donations" element={<Page><NgoDonationListPage /></Page>} />
          <Route path="/ngo/donations/:matchId" element={<Page><NgoDonationDetailsPage /></Page>} />
          <Route path="/ngo/accepted" element={<Page><NgoDonationListPage acceptedOnly /></Page>} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['RECIPIENT']} />}>
        <Route element={<AuthenticatedLayout />}>
          <Route path="/recipient/analytics" element={<Page><AnalyticsPage /></Page>} />
          <Route path="/recipient" element={<Page><RecipientPage view="available" /></Page>} />
          <Route path="/recipient/requests" element={<Page><RecipientPage view="requests" /></Page>} />
          <Route path="/recipient/profile" element={<Page><RecipientPage view="profile" /></Page>} />
          <Route path="/recipient/collection/:donationId" element={<Page><RecipientPage view="collection" /></Page>} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
        <Route element={<AuthenticatedLayout />}>
          <Route path="/admin/analytics" element={<Page><AnalyticsPage /></Page>} />
          <Route path="/admin" element={<Page><AdminDashboardPage /></Page>} />
          <Route path="/admin/users" element={<Page><AdminRecordsPage key="users" view="users" /></Page>} />
          <Route path="/admin/donations" element={<Page><AdminRecordsPage key="donations" view="donations" /></Page>} />
          <Route path="/admin/ngos" element={<Page><AdminRecordsPage key="ngos" view="ngos" /></Page>} />
          <Route path="/admin/recipients" element={<Page><AdminRecordsPage key="recipients" view="recipients" /></Page>} />
          <Route path="/admin/activity" element={<Page><AdminRecordsPage key="activity" view="activity" /></Page>} />
          <Route path="/admin/activity-logs" element={<Navigate to="/admin/activity" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<UnknownRoute />} />
    </Routes>
  )
}
