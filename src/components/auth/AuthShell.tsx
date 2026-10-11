import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { InformationLinks } from '../common/InformationLinks'
import { Icon } from '../common/Icon'
import './auth.css'

export function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  const { pathname } = useLocation()
  const registering = pathname === '/register'
  return <div className="auth-page">
    <header className="auth-topbar">
      <Link to="/" className="auth-brand" aria-label="RescueBite home"><span><Icon name="leaf" width="23" height="23" /></span>RescueBite<span className="auth-brand-dot">.</span></Link>
      <Link to="/" className="auth-home-link">Back to overview <Icon name="arrow" width="16" /></Link>
    </header>
    <div className="auth-layout">
      <aside className="auth-story" aria-label="The RescueBite community">
        <div><p className="auth-eyebrow">Every portion has a purpose</p><h2>Good food.<br />Shared with <em>good people.</em></h2><p className="auth-story-intro">A little surplus can go a long way. Be part of a community that helps it find a better destination.</p></div>
        <div className="auth-illustration" aria-hidden="true">
          <div className="auth-orbit" /><div className="auth-plate"><div><Icon name="leaf" width="62" height="62" /></div></div>
          <span className="auth-food-node"><Icon name="box" width="25" height="25" /><span>Something to share</span></span>
          <span className="auth-people-node"><Icon name="users" width="25" height="25" /><span>Someone to receive</span></span>
          <span className="auth-spark auth-spark-one">✦</span><span className="auth-spark auth-spark-two">✦</span>
        </div>
        <div className="auth-story-footer"><span className="auth-community-icons" aria-hidden="true"><Icon name="box" /><Icon name="building" /><Icon name="users" /></span><p>Donors. NGOs. Individuals.<br /><strong>One shared purpose.</strong></p></div>
      </aside>
      <main className="auth-main" id="auth-content">
        <div className="auth-card">
          <nav className="auth-switch" aria-label="Account access"><Link to="/login" aria-current={pathname === '/login' ? 'page' : undefined}>Sign in</Link><Link to="/register" aria-current={registering ? 'page' : undefined}>Create account</Link></nav>
          <div className="auth-heading"><p className="auth-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
          {children}
        </div>
        <footer className="auth-footer"><InformationLinks /></footer>
      </main>
    </div>
  </div>
}
