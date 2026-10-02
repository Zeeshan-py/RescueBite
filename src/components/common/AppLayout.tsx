import { useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { roleHomePath } from '../../auth/route-access'
import { useAuth } from '../../auth/useAuth'
import type { UserRole } from '../../types/domain'
import { NotificationProvider } from '../../services/notifications/NotificationProvider'
import { NotificationBell } from '../notifications/NotificationBell'

const navigation: Record<UserRole, Array<{ label: string; to: string }>> = {
  DONOR: [
    { label: 'Dashboard', to: '/donor' }, { label: 'Analytics', to: '/donor/analytics' }, { label: 'My donations', to: '/donor/donations' },
    { label: 'Create donation', to: '/donor/donations/new' },
    { label: 'Notifications', to: '/notifications' }, { label: 'Profile', to: '/profile' },
  ],
  NGO: [
    { label: 'Dashboard', to: '/ngo' }, { label: 'Analytics', to: '/ngo/analytics' }, { label: 'Available donations', to: '/ngo/donations' },
    { label: 'Accepted donations', to: '/ngo/accepted' }, { label: 'Organization profile', to: '/ngo/setup' },
    { label: 'Notifications', to: '/notifications' }, { label: 'Profile', to: '/profile' },
  ],
  VOLUNTEER: [
    { label: 'Dashboard', to: '/volunteer' }, { label: 'Analytics', to: '/volunteer/analytics' }, { label: 'Pickup tasks', to: '/volunteer/pickups' },
    { label: 'Notifications', to: '/notifications' }, { label: 'Profile', to: '/profile' },
  ],
  ADMIN: [
    { label: 'Dashboard', to: '/admin' }, { label: 'Analytics', to: '/admin/analytics' }, { label: 'Users', to: '/admin/users' },
    { label: 'Donations', to: '/admin/donations' }, { label: 'NGOs', to: '/admin/ngos' },
    { label: 'Volunteers', to: '/admin/volunteers' }, { label: 'Activity logs', to: '/admin/activity' },
  ],
}

function pageLabel(pathname: string, role: UserRole | null) {
  return role ? navigation[role].find((item) => item.to === pathname)?.label ?? 'Workspace' : 'Overview'
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const { role, profile, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const items = role ? navigation[role] : []
  const homePath = role ? roleHomePath[role] : '/'

  async function handleLogout() {
    setIsSigningOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setIsSigningOut(false)
    }
  }

  const layout = (
    <div className="min-h-screen lg:grid lg:grid-cols-[252px_1fr]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Skip to content</a>
      <aside className="bg-pine text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-6 sm:px-6">
          <Link to={homePath} className="flex items-center gap-3" aria-label="FoodBridge home" onClick={() => setMenuOpen(false)}>
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-lime text-pine"><svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M19 4C8 3 3 8 6 15c7 4 13-1 13-11Z" /><path d="M4 21 15 10" /></svg></span>
            <span><span className="block font-display text-2xl">FoodBridge</span><span className="text-[11px] text-white/65">Surplus food. Shared purpose.</span></span>
          </Link>
          <button className="rounded-lg border border-white/30 px-3 py-2 text-sm lg:hidden" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close' : 'Menu'}</button>
        </div>
        <nav id="main-navigation" aria-label="Main navigation" className={`${menuOpen ? 'block' : 'hidden'} px-4 py-7 lg:block`}>
          <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.2em] text-white/55 uppercase">{role ? `${role.toLowerCase()} workspace` : 'Welcome'}</p>
          {isAuthenticated && role ? items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === homePath} onClick={() => setMenuOpen(false)} className={({ isActive }) => `mb-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${isActive ? 'bg-white/12 text-white' : 'text-white/68 hover:bg-white/7 hover:text-white'}`}>
              <span aria-hidden="true" className="text-lime">•</span>{item.label}
            </NavLink>
          )) : (
            <>
              <NavLink to="/" className="mb-2 flex items-center gap-3 rounded-lg bg-white/10 px-3 py-3 text-sm font-medium">Overview</NavLink>
              <Link to="/login" className="mt-4 flex rounded-lg border border-white/20 px-3 py-3 text-sm font-medium hover:bg-white/10">Sign in</Link>
              <Link to="/register" className="mt-2 flex rounded-lg bg-lime px-3 py-3 text-sm font-semibold text-pine hover:bg-white">Create account</Link>
            </>
          )}
        </nav>
        <div className="mt-auto border-t border-white/10 p-5 sm:p-6">
          {isAuthenticated ? (
            <div><p className="truncate text-sm font-semibold">{profile?.name ?? 'FoodBridge member'}</p><p className="mt-1 text-xs text-white/55">{role}</p><button onClick={() => void handleLogout()} disabled={isSigningOut} className="mt-4 text-xs font-semibold text-lime hover:text-white disabled:opacity-60">{isSigningOut ? 'Signing out…' : 'Sign out'}</button></div>
          ) : <p className="text-sm text-lime">A little less waste.<br />A little more possibility.</p>}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-4 border-b border-line bg-white px-5 py-5 sm:px-10"><p className="min-w-0 truncate text-sm text-muted">FoodBridge <span aria-hidden="true" className="mx-2 text-line">/</span> <span className="text-ink">{pageLabel(location.pathname, role)}</span></p><div className="flex shrink-0 items-center gap-3">{isAuthenticated && <NotificationBell />}<span className="hidden rounded-full border border-line px-3 py-1 text-xs text-muted sm:inline">{role ? role[0] + role.slice(1).toLowerCase() : 'Public'}</span></div></header>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-8 sm:px-10 sm:py-12">{children}</main>
        <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-5 pb-6 text-xs text-muted sm:px-10"><span>FoodBridge · Food Rescue & Surplus Redistribution</span><span>SE Lab · Phase 12</span></footer>
      </div>
    </div>
  )
  return isAuthenticated ? <NotificationProvider>{layout}</NotificationProvider> : layout
}
