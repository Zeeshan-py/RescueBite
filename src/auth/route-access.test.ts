import { describe, expect, it } from 'vitest'
import { canRoleAccessPath, roleHomePath } from './route-access'

describe('role route access', () => {
  it.each(['DONOR', 'NGO', 'RECIPIENT'] as const)('denies %s every admin route', (role) => {
    for (const path of ['/admin', '/admin/users', '/admin/donations', '/admin/ngos', '/admin/recipients', '/admin/activity', '/admin/analytics']) {
      expect(canRoleAccessPath(role, path)).toBe(false)
      expect(canRoleAccessPath('ADMIN', path)).toBe(true)
    }
  })
  it('maps every role to its dashboard', () => {
    expect(roleHomePath).toEqual({ DONOR: '/donor', NGO: '/ngo', RECIPIENT: '/recipient', ADMIN: '/admin' })
  })

  it('blocks cross-role workspace access', () => {
    expect(canRoleAccessPath('DONOR', '/ngo')).toBe(false)
    expect(canRoleAccessPath('DONOR', '/recipient/tasks')).toBe(false)
    expect(canRoleAccessPath('DONOR', '/admin')).toBe(false)
    expect(canRoleAccessPath('RECIPIENT', '/donor')).toBe(false)
    expect(canRoleAccessPath('NGO', '/admin/users')).toBe(false)
  })

  it('allows each role into its own workspace and shared account pages', () => {
    expect(canRoleAccessPath('DONOR', '/donor/donations')).toBe(true)
    expect(canRoleAccessPath('NGO', '/ngo/setup')).toBe(true)
    expect(canRoleAccessPath('RECIPIENT', '/recipient/tasks')).toBe(true)
    expect(canRoleAccessPath('ADMIN', '/admin/activity-logs')).toBe(true)
    expect(canRoleAccessPath('DONOR', '/profile')).toBe(true)
  })
})
