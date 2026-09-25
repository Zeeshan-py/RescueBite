import type { UserRole } from '../types/domain'

export const roleHomePath: Record<UserRole, string> = {
  DONOR: '/donor',
  NGO: '/ngo',
  VOLUNTEER: '/volunteer',
  ADMIN: '/admin',
}

const protectedPrefixes: Array<[string, UserRole]> = [
  ['/donor', 'DONOR'],
  ['/ngo', 'NGO'],
  ['/volunteer', 'VOLUNTEER'],
  ['/admin', 'ADMIN'],
]

export function canRoleAccessPath(role: UserRole, pathname: string): boolean {
  if (pathname === '/profile' || pathname === '/notifications') return true
  const match = protectedPrefixes.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  return !match || match[1] === role
}
