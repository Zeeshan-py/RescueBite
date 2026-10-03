import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { UserRole } from '../types/domain'

const { auth } = vi.hoisted(() => ({ auth: { isLoading: false, isAuthenticated: true, role: 'DONOR' as string | null, error: null as string | null } }))
vi.mock('./useAuth', () => ({ useAuth: () => auth }))
import { ProtectedRoute } from './ProtectedRoute'

function render(allowedRoles: UserRole[]) {
  return renderToString(<MemoryRouter initialEntries={['/private']}><Routes><Route element={<ProtectedRoute allowedRoles={allowedRoles} />}><Route path="/private" element={<p>Protected content</p>} /></Route></Routes></MemoryRouter>)
}
describe('protected route rendering', () => {
  it.each(['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'] as UserRole[])('permits a loaded %s profile only in its role route', (role) => {
    Object.assign(auth, { isLoading: false, isAuthenticated: true, role, error: null })
    expect(render([role])).toContain('Protected content')
    const anotherRole = role === 'ADMIN' ? 'DONOR' : 'ADMIN'
    expect(render([anotherRole])).not.toContain('Protected content')
  })
  it.each([
    { isLoading: false, isAuthenticated: false, role: null, error: null },
    { isLoading: true, isAuthenticated: true, role: 'ADMIN', error: null },
    { isLoading: false, isAuthenticated: true, role: null, error: null },
    { isLoading: false, isAuthenticated: true, role: 'ADMIN', error: 'Profile unavailable' },
  ])('does not render protected content for unresolved or invalid auth %#', (state) => {
    Object.assign(auth, state)
    expect(render(['ADMIN'])).not.toContain('Protected content')
  })
})
