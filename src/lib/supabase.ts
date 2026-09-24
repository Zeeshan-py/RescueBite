import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function configurationError(): string | null {
  if (!url || !anonKey) {
    return 'Supabase is not configured. Add the two variables from .env.example to .env.local and restart the dev server.'
  }
  try {
    if (!['http:', 'https:'].includes(new URL(url).protocol)) {
      return 'VITE_SUPABASE_URL must be an HTTP or HTTPS URL.'
    }
  } catch {
    return 'VITE_SUPABASE_URL must be a valid HTTP or HTTPS URL.'
  }
  return null
}

export const supabaseConfigurationError = configurationError()
let client: SupabaseClient | undefined

// Lazy initialization keeps the foundation usable without credentials or auth activity.
// Future service modules should obtain the shared client through this function.
export function getSupabaseClient(): SupabaseClient {
  if (supabaseConfigurationError || !url || !anonKey) {
    throw new Error(supabaseConfigurationError ?? 'Supabase configuration is missing.')
  }
  client ??= createClient(url, anonKey)
  return client
}
