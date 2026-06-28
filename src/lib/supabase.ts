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
 * Liefert die ID des aktuell angemeldeten Trainers und stellt sicher, dass das
 * Zugriffstoken gültig ist. Ein abgelaufenes Token würde sonst dazu führen, dass die
 * Anfrage „anonym" bei der DB ankommt (auth.uid() = NULL) und an der RLS scheitert –
 * genau das verursachte „new row violates row-level security policy". Daher: bei
 * abgelaufenem (oder fast abgelaufenem) Token vorher auffrischen.
 */
export async function aktuelleUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Deine Sitzung ist nicht mehr aktiv. Bitte melde dich neu an.')
  }
  // expires_at ist in Sekunden; mit 30 s Puffer rechtzeitig auffrischen
  const abgelaufen = session.expires_at ? session.expires_at * 1000 < Date.now() + 30_000 : false
  if (abgelaufen) {
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session) {
      throw new Error('Deine Sitzung ist abgelaufen. Bitte melde dich neu an.')
    }
    return data.session.user.id
  }
  return session.user.id
}
