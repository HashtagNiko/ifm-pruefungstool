import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Ob die Supabase-Zugangsdaten in der .env hinterlegt sind.
 * Solange `false`, läuft die App im "Gerüst-Modus" ohne Backend.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * Geteilter Supabase-Client für die ganze App.
 * Erst nutzbar, sobald VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY gesetzt sind
 * (siehe .env.example). Wir werfen erst beim tatsächlichen Zugriff, damit das
 * Grundgerüst auch ohne Keys startet.
 */
export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!)
  : (new Proxy(
      {},
      {
        get() {
          throw new Error(
            'Supabase ist nicht konfiguriert. Bitte VITE_SUPABASE_URL und ' +
              'VITE_SUPABASE_ANON_KEY in der .env-Datei setzen (siehe .env.example).',
          )
        },
      },
    ) as ReturnType<typeof createClient<Database>>)

/**
 * Liefert die ID des aktuell angemeldeten Trainers – frisch aus der verifizierten
 * Session (nicht aus möglicherweise veraltetem React-State). So passt eine gesendete
 * `owner_id` immer zu `auth.uid()` der Anfrage; bei abgelaufener Sitzung wird geworfen.
 */
export async function aktuelleUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    throw new Error('Deine Sitzung ist nicht mehr aktiv. Bitte neu anmelden.')
  }
  return data.user.id
}
