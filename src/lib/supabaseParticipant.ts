import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Eigener Supabase-Client für den Teilnehmer-Bereich.
 * Bewusst mit separatem storageKey, damit die anonyme Teilnehmer-Session
 * NICHT die Trainer-Session im selben Browser überschreibt (und umgekehrt).
 */
export const supabaseP = createClient<Database>(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storageKey: 'sb-teilnehmer-auth',
    persistSession: true,
    autoRefreshToken: true,
  },
})

/** Stellt sicher, dass eine (anonyme) Session existiert. */
export async function ensureAnonSession(): Promise<void> {
  const { data } = await supabaseP.auth.getSession()
  if (!data.session) {
    const { error } = await supabaseP.auth.signInAnonymously()
    if (error) throw error
  }
}
