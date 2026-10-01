import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute'
import { roleHomePath } from './auth/route-access'
import { useAuth } from './auth/useAuth'
import { AppLayout } from './components/common/AppLayout'
import { LoadingState } from './components/common/LoadingState'
import type { UserRole } from './types/domain'

const OverviewPage = lazy(() => import('./pages/OverviewPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const RoleDashboardPage = lazy(() => import('./pages/dashboard/RoleDashboardPage'))
const PlaceholderPage = lazy(() => import('./pages/dashboard/PlaceholderPage'))
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
const VolunteerDashboardPage = lazy(() => import('./pages/volunteer/VolunteerDashboardPage'))
const PickupListPage = lazy(() => import('./pages/volunteer/PickupListPage'))
const PickupDetailsPage = lazy(() => import('./pages/volunteer/PickupDetailsPage'))
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'))

const allRoles: UserRole[] = ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN']

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState label="Loading page…" />}>{children}</Suspense>
}

function HomeRoute() {
  const { isLoading, isAuthenticated, role } = useAuth()
  if (isLoading) return <LoadingState label="Loading application…" fullScreen />
  if (isAuthenticated && role) return <Navigate to={roleHomePath[role]} replace />
  return <AppLayout><Page><OverviewPage /></Page></AppLayout>
}

function AuthenticatedLayout() {
  return <AppLayout><Outlet /></AppLayout>
}

function UnknownRoute() {
  const { role } = useAuth()
  return <Navigate to={role ? roleHomePath[role] : '/'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
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
          <Route path="/donor" element={<Page><DonorDashboardPage /></Page>} />
          <Route path="/donor/donations" element={<Page><DonationListPage /></Page>} />
          <Route path="/donor/donations/new" element={<Page><DonationFormPage /></Page>} />
          <Route path="/donor/donations/:id" element={<Page><DonationDetailsPage /></Page>} />
          <Route path="/donor/donations/:id/edit" element={<Page><DonationFormPage /></Page>} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['NGO']} />}>
        <Route element={<AuthenticatedLayout />}>
          <Route path="/ngo" element={<Page><NgoDashboardPage /></Page>} />
          <Route path="/ngo/setup" element={<Page><NgoSetupPage /></Page>} />
          <Route path="/ngo/donations" element={<Page><NgoDonationListPage /></Page>} />
          <Route path="/ngo/donations/:matchId" element={<Page><NgoDonationDetailsPage /></Page>} />
          <Route path="/ngo/accepted" element={<Page><NgoDonationListPage acceptedOnly /></Page>} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['VOLUNTEER']} />}>
        <Route element={<AuthenticatedLayout />}>
          <Route path="/volunteer" element={<Page><VolunteerDashboardPage /></Page>} />
          <Route path="/volunteer/pickups" element={<Page><PickupListPage /></Page>} />
          <Route path="/volunteer/pickups/:id" element={<Page><PickupDetailsPage /></Page>} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
        <Route element={<AuthenticatedLayout />}>
          <Route path="/admin" element={<Page><RoleDashboardPage /></Page>} />
          <Route path="/admin/users" element={<Page><PlaceholderPage title="Users" description="Administrative user management will be implemented in a later phase." /></Page>} />
          <Route path="/admin/donations" element={<Page><PlaceholderPage title="Donations" description="Administrative donation oversight will be implemented in a later phase." /></Page>} />
          <Route path="/admin/ngos" element={<Page><PlaceholderPage title="NGOs" description="Organization management will be implemented in a later phase." /></Page>} />
          <Route path="/admin/volunteers" element={<Page><PlaceholderPage title="Volunteers" description="Volunteer administration will be implemented in a later phase." /></Page>} />
          <Route path="/admin/activity-logs" element={<Page><PlaceholderPage title="Activity logs" description="The database is protected for administrator access; the viewer comes in a later phase." /></Page>} />
        </Route>
      </Route>
      <Route path="*" element={<UnknownRoute />} />
    </Routes>
  )
}
