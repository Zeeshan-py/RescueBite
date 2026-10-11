import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { roleHomePath } from '../../auth/route-access'
import { useAuth } from '../../auth/useAuth'
import type { UserRole } from '../../types/domain'
import { NotificationProvider } from '../../services/notifications/NotificationProvider'
import { NotificationBell } from '../notifications/NotificationBell'
import { InformationLinks } from './InformationLinks'
import { Icon, type IconName } from './Icon'
import { SidebarResizeHandle } from './SidebarResizeHandle'
import { readSidebarPreferences, SIDEBAR_STORAGE_KEY } from './sidebar-preferences'

const navigationIcons: Record<string, IconName> = {
  Dashboard: 'grid', Analytics: 'chart', Users: 'users', Donations: 'box', NGOs: 'building',
  Recipients: 'users', 'Available Meals': 'box', 'My Requests': 'activity', 'Activity logs': 'activity', 'My donations': 'box', 'Create donation': 'plus',
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
  RECIPIENT: [
    { label: 'Available Meals', to: '/recipient' }, { label: 'My Requests', to: '/recipient/requests' }, { label: 'Analytics', to: '/recipient/analytics' },
    { label: 'Notifications', to: '/notifications' }, { label: 'Profile', to: '/recipient/profile' },
  ],
  ADMIN: [
    { label: 'Dashboard', to: '/admin' }, { label: 'Analytics', to: '/admin/analytics' }, { label: 'Users', to: '/admin/users' },
    { label: 'Donations', to: '/admin/donations' }, { label: 'NGOs', to: '/admin/ngos' },
    { label: 'Recipients', to: '/admin/recipients' }, { label: 'Activity logs', to: '/admin/activity' },
  ],
}

function pageLabel(pathname: string, role: UserRole | null) {
  const publicLabels: Record<string, string> = { '/about': 'About', '/faq': 'FAQ', '/contact': 'Contact', '/terms': 'Terms of Use', '/privacy': 'Privacy Policy', '/food-safety': 'Food safety' }
  if (publicLabels[pathname]) return publicLabels[pathname]
  if (/\/donations\/[^/]+\/edit$/.test(pathname)) return 'Edit donation'
  if (/\/donations\/[^/]+$/.test(pathname) && !pathname.endsWith('/new')) return 'Donation details'
  if (/\/recipient\/collection\/[^/]+$/.test(pathname)) return 'Collection details'
  return role ? navigation[role].find((item) => item.to === pathname)?.label ?? 'Workspace' : 'Overview'
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebar, setSidebar] = useState(readSidebarPreferences)
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(sidebar)) } catch { /* Resizing works without storage. */ }
  }, [sidebar])
  const menuButton = useRef<HTMLButtonElement>(null)
  const mobileMenu = useRef<HTMLDialogElement>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const { user, role, profile, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const items = role ? navigation[role] : []
  const homePath = role ? roleHomePath[role] : '/'
  const activePath = [...items].sort((a, b) => b.to.length - a.to.length).find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))?.to
  useEffect(() => {
    if (!menuOpen) return
    const dialog = mobileMenu.current
    if (!dialog) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => { if (desktop.matches) dialog.close() }
    desktop.addEventListener('change', closeOnDesktop)
    return () => {
      document.body.style.overflow = previousOverflow
      desktop.removeEventListener('change', closeOnDesktop)
      if (dialog.open) dialog.close()
    }
  }, [menuOpen])
  useEffect(() => { mobileMenu.current?.close() }, [location.pathname])

  function closeMenu() {
    mobileMenu.current?.close()
  }

  function navigationLinks() {
    return isAuthenticated && role ? items.map((item) => (
      <Link key={item.to} to={item.to} title={item.label} aria-current={activePath === item.to ? 'page' : undefined} onClick={closeMenu} className={`sidebar-link${activePath === item.to ? ' is-active' : ''}`}>
        <Icon name={navigationIcons[item.label] ?? 'grid'} /><span>{item.label}</span>{activePath === item.to && <span className="nav-active-dot" />}
      </Link>
    )) : <>
      <NavLink to="/" end title="Overview" onClick={closeMenu} className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}><Icon name="grid" /><span>Overview</span></NavLink>
      <Link to="/login" title="Sign in" onClick={closeMenu} className="sidebar-link"><Icon name="user" /><span>Sign in</span></Link>
      <Link to="/register" title="Create account" onClick={closeMenu} className="sidebar-link"><Icon name="plus" /><span>Create account</span></Link>
    </>
  }

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
    <div className={`app-shell${sidebar.collapsed ? ' sidebar-collapsed' : ''}`} style={{ '--sidebar-width': `${sidebar.collapsed ? 72 : sidebar.width}px` } as CSSProperties}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Skip to content</a>
      <aside id="desktop-sidebar" className="app-sidebar">
        <div className="sidebar-brand">
          <Link to={homePath} className="flex items-center gap-3" aria-label="RescueBite home" onClick={() => setMenuOpen(false)}>
            <span className="brand-symbol"><Icon name="leaf" width="24" height="24" /></span>
            <span className="sidebar-brand-copy"><span className="brand-name">RescueBite<span>.</span></span></span>
          </Link>
        </div>
        <nav id="main-navigation" aria-label="Main navigation" className={`sidebar-navigation${menuOpen ? ' is-open' : ''}`}>
          <p className="sidebar-label">{role ? `${role.toLowerCase()} workspace` : 'Discover RescueBite'}</p>
          {navigationLinks()}
        </nav>
        <div className={`sidebar-bottom${menuOpen ? ' is-open' : ''}`}>
          {isAuthenticated ? (
            <div className="sidebar-profile"><span className="profile-avatar">{(profile?.name ?? 'RB').split(' ').slice(0, 2).map(part => part[0]).join('')}</span><div><p>{profile?.name ?? 'RescueBite member'}</p><span>{role === 'ADMIN' ? 'Administrator' : role?.toLowerCase()}</span></div><button onClick={() => void handleLogout()} disabled={isSigningOut} aria-label={isSigningOut ? 'Signing out' : 'Sign out'} title="Sign out"><Icon name="logout" width="18" /></button></div>
          ) : <Link to="/about" title="About RescueBite" className="sidebar-link"><Icon name="leaf" /><span>About RescueBite</span></Link>}
        </div>
        {!sidebar.collapsed && <SidebarResizeHandle width={sidebar.width} onResize={width => setSidebar(previous => ({ ...previous, width }))} />}
      </aside>
      <div className="min-w-0">
        <header className="workspace-topbar">
          <button type="button" className="desktop-sidebar-toggle" aria-label={sidebar.collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebar.collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebar.collapsed} aria-controls="desktop-sidebar" onClick={() => setSidebar(previous => ({ ...previous, collapsed: !previous.collapsed }))}><Icon name="panel" /></button>
          <Link to={homePath} className="mobile-brand" aria-label="RescueBite home"><span className="brand-symbol"><Icon name="leaf" width="21" height="21" /></span><span>RescueBite<span className="mobile-brand-dot">.</span></span></Link>
          <nav aria-label="Breadcrumb" className="workspace-breadcrumb"><Link to={homePath}>{role ? 'Workspace' : 'RescueBite'}</Link><Icon name="chevron" width="14" height="14" /><span aria-current="page">{pageLabel(location.pathname, role)}</span></nav>
          <div className="topbar-actions"><span className="workspace-tag"><Icon name="shield" width="15" />{role === 'ADMIN' ? 'Admin workspace' : 'Food rescue network'}</span>{isAuthenticated && <NotificationBell />}<button ref={menuButton} type="button" className="sidebar-menu-button" aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(true)}><Icon name="menu" /></button></div>
        </header>
        <main id="main-content" tabIndex={-1} className="workspace-main">{children}</main>
        <footer className="workspace-footer"><InformationLinks /><p>RescueBite · A better future for surplus food.</p></footer>
      </div>
      <dialog ref={mobileMenu} id="mobile-navigation" className="mobile-navigation" aria-labelledby="mobile-navigation-title" onClose={() => { setMenuOpen(false); menuButton.current?.focus() }} onClick={(event) => { if (event.target === event.currentTarget) closeMenu() }}>
        <div className="mobile-navigation-content">
          <div className="mobile-navigation-heading"><h2 id="mobile-navigation-title">Menu</h2><button type="button" className="mobile-menu-close" aria-label="Close navigation" autoFocus onClick={closeMenu}><Icon name="close" /></button></div>
          {isAuthenticated && <div className="mobile-account"><span className="profile-avatar">{(profile?.name ?? 'RB').split(' ').slice(0, 2).map(part => part[0]).join('')}</span><div><strong>{profile?.name ?? 'RescueBite member'}</strong><span>{role === 'ADMIN' ? 'Administrator' : role?.toLowerCase()}</span></div></div>}
          <nav aria-label="Mobile navigation" className="mobile-navigation-links">{navigationLinks()}</nav>
          <div className="mobile-navigation-footer"><Link to="/about" onClick={closeMenu}><Icon name="leaf" width="18" />About RescueBite</Link>{isAuthenticated && <button type="button" disabled={isSigningOut} onClick={() => { closeMenu(); void handleLogout() }}><Icon name="logout" width="18" />{isSigningOut ? 'Signing out…' : 'Sign out'}</button>}</div>
        </div>
      </dialog>
    </div>
  )
  return isAuthenticated ? <NotificationProvider key={user?.id}>{layout}</NotificationProvider> : layout
}
