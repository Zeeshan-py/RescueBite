import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { roleHomePath } from '../../auth/route-access'
import { useAuth } from '../../auth/useAuth'
import type { UserRole } from '../../types/domain'
import { NotificationProvider } from '../../services/notifications/NotificationProvider'
import { NotificationBell } from '../notifications/NotificationBell'
import { InformationLinks } from './InformationLinks'
import { Icon, type IconName } from './Icon'

const navigationIcons: Record<string, IconName> = {
  Dashboard: 'grid', Analytics: 'chart', Users: 'users', Donations: 'box', NGOs: 'building',
  Volunteers: 'truck', 'Activity logs': 'activity', 'My donations': 'box', 'Create donation': 'plus',
  'Available donations': 'box', 'Accepted donations': 'check', 'Organization profile': 'building',
  Notifications: 'bell', Profile: 'user', 'Pickup tasks': 'truck',
}

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
  const publicLabels: Record<string, string> = { '/about': 'About', '/faq': 'FAQ', '/contact': 'Contact', '/terms': 'Terms of Use', '/privacy': 'Privacy Policy', '/food-safety': 'Food safety' }
  if (publicLabels[pathname]) return publicLabels[pathname]
  if (/\/donations\/[^/]+\/edit$/.test(pathname)) return 'Edit donation'
  if (/\/donations\/[^/]+$/.test(pathname) && !pathname.endsWith('/new')) return 'Donation details'
  if (/\/pickups\/[^/]+$/.test(pathname)) return 'Pickup details'
  return role ? navigation[role].find((item) => item.to === pathname)?.label ?? 'Workspace' : 'Overview'
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const { user, role, profile, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const items = role ? navigation[role] : []
  const homePath = role ? roleHomePath[role] : '/'
  const activePath = [...items].sort((a, b) => b.to.length - a.to.length).find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))?.to
  useEffect(() => {
    if (!menuOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus() } }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [menuOpen])

  async function handleLogout() {
    setIsSigningOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      navigate('/login', { replace: true, state: { logoutWarning: 'You are signed out on this device. Other sessions could not be revoked; check your connection.' } })
    } finally {
      setIsSigningOut(false)
    }
  }

  const layout = (
    <div className="app-shell">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Skip to content</a>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <Link to={homePath} className="flex items-center gap-3" aria-label="RescueBite home" onClick={() => setMenuOpen(false)}>
            <span className="brand-symbol"><Icon name="leaf" width="24" height="24" /></span>
            <span><span className="brand-name">RescueBite<span>.</span></span><span className="brand-caption">Every portion has a purpose</span></span>
          </Link>
          <button ref={menuButton} type="button" className="sidebar-menu-button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
        </div>
        <nav id="main-navigation" aria-label="Main navigation" className={`sidebar-navigation${menuOpen ? ' is-open' : ''}`}>
          <p className="sidebar-label">{role ? `${role.toLowerCase()} workspace` : 'Discover RescueBite'}</p>
          {isAuthenticated && role ? items.map((item) => (
            <Link key={item.to} to={item.to} aria-current={activePath === item.to ? 'page' : undefined} onClick={() => setMenuOpen(false)} className={`sidebar-link${activePath === item.to ? ' is-active' : ''}`}>
              <Icon name={navigationIcons[item.label] ?? 'grid'} /><span>{item.label}</span>{activePath === item.to && <span className="nav-active-dot" />}
            </Link>
          )) : (
            <>
              <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}><Icon name="grid" />Overview</NavLink>
              <Link to="/login" className="sidebar-link"><Icon name="user" />Sign in</Link>
              <Link to="/register" className="sidebar-link"><Icon name="plus" />Create account</Link>
            </>
          )}
        </nav>
        <div className={`sidebar-bottom${menuOpen ? ' is-open' : ''}`}>
          <div className="sidebar-purpose"><Icon name="leaf" /><p>Good food.<br /><strong>Greater possibilities.</strong></p><span>Connecting surplus with purpose.</span></div>
          {isAuthenticated ? (
            <div className="sidebar-profile"><span className="profile-avatar">{(profile?.name ?? 'RB').split(' ').slice(0, 2).map(part => part[0]).join('')}</span><div><p>{profile?.name ?? 'RescueBite member'}</p><span>{role === 'ADMIN' ? 'Administrator' : role?.toLowerCase()}</span></div><button onClick={() => void handleLogout()} disabled={isSigningOut} aria-label={isSigningOut ? 'Signing out' : 'Sign out'} title="Sign out"><Icon name="logout" width="18" /></button></div>
          ) : <Link to="/about" className="sidebar-link">Our mission <Icon name="arrow" /></Link>}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="workspace-topbar"><nav aria-label="Breadcrumb" className="workspace-breadcrumb"><Link to={homePath}>{role ? 'Workspace' : 'RescueBite'}</Link><Icon name="chevron" width="14" height="14" /><span aria-current="page">{pageLabel(location.pathname, role)}</span></nav><div className="topbar-actions"><span className="workspace-tag"><Icon name="shield" width="15" />{role === 'ADMIN' ? 'Admin workspace' : 'Food rescue network'}</span>{isAuthenticated && <NotificationBell />}</div></header>
        <main id="main-content" tabIndex={-1} className="workspace-main">{children}</main>
        <footer className="workspace-footer"><InformationLinks /><p>RescueBite · A better future for surplus food.</p></footer>
      </div>
    </div>
  )
  return isAuthenticated ? <NotificationProvider key={user?.id}>{layout}</NotificationProvider> : layout
}
