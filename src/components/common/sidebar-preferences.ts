export const SIDEBAR_MIN = 216
export const SIDEBAR_MAX = 336
export const SIDEBAR_DEFAULT = 238
export const SIDEBAR_STORAGE_KEY = 'rescuebite.sidebar'

export function sidebarWidth(value: number) {
  return Number.isFinite(value) ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(value))) : SIDEBAR_DEFAULT
}

export function readSidebarPreferences() {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SIDEBAR_STORAGE_KEY) ?? 'null')
    if (saved && typeof saved === 'object') {
      const value = saved as { width?: unknown; collapsed?: unknown }
      return { width: typeof value.width === 'number' ? sidebarWidth(value.width) : SIDEBAR_DEFAULT, collapsed: value.collapsed === true }
    }
  } catch { /* Storage may be unavailable in private browsing. */ }
  return { width: SIDEBAR_DEFAULT, collapsed: false }
}
