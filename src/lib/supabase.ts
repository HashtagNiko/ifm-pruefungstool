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

/** Liest den `sub`-Claim (= User-ID) aus einem JWT-Access-Token. */
function subAusToken(token: string): string | null {
  try {
    const teil = token.split('.')[1]
    const json = atob(teil.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(decodeURIComponent(escape(json))) as { sub?: unknown }
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

/**
 * Liefert die ID des aktuell angemeldeten Trainers – und zwar exakt den `sub` aus dem
 * Access-Token, das die Anfrage trägt. So ist `owner_id` immer identisch mit `auth.uid()`
 * der DB-Anfrage, selbst wenn der lokale Session-User-State davon abweicht (Ursache des
 * Fehlers „new row violates row-level security policy"). Abgelaufene Token werden vorher
 * aufgefrischt; ist gar keine Sitzung aktiv, wird mit klarer Meldung geworfen.
 */
export async function aktuelleUserId(): Promise<string> {
  let {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Deine Sitzung ist nicht mehr aktiv. Bitte melde dich neu an.')
  }
  // expires_at ist in Sekunden; mit 60 s Puffer rechtzeitig auffrischen
  const abgelaufen = session.expires_at ? session.expires_at * 1000 < Date.now() + 60_000 : false
  if (abgelaufen) {
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session) {
      throw new Error('Deine Sitzung ist abgelaufen. Bitte melde dich neu an.')
    }
    session = data.session
  }
  const sub = subAusToken(session.access_token) ?? session.user.id
  return sub
}
