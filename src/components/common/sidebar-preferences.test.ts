import { afterEach, describe, expect, it, vi } from 'vitest'
import { readSidebarPreferences, sidebarWidth } from './sidebar-preferences'

afterEach(() => vi.unstubAllGlobals())

describe('sidebar preferences', () => {
  it('keeps resizing within usable laptop widths', () => {
    expect(sidebarWidth(0)).toBe(216)
    expect(sidebarWidth(1000)).toBe(336)
    expect(sidebarWidth(270.6)).toBe(271)
    expect(sidebarWidth(NaN)).toBe(238)
  })
  it('recovers from malformed saved settings', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{broken' })
    expect(readSidebarPreferences()).toEqual({ width: 238, collapsed: false })
  })
  it('restores the last width without trusting invalid values', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{"width":280,"collapsed":true}' })
    expect(readSidebarPreferences()).toEqual({ width: 280, collapsed: true })
    vi.stubGlobal('localStorage', { getItem: () => '{"width":9999,"collapsed":"false"}' })
    expect(readSidebarPreferences()).toEqual({ width: 336, collapsed: false })
  })
  it('works when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Storage blocked') } })
    expect(readSidebarPreferences()).toEqual({ width: 238, collapsed: false })
  })
})
