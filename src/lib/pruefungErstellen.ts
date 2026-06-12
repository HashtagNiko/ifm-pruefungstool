import { supabase } from './supabase'
import type { Tables } from './database.types'

/**
 * Clientseitige Erstellung einer Prüfung aus einer Vorlage:
 * zufällige Fragenauswahl je Themengebiet -> Snapshot (pruefung_frage).
 * Später ggf. durch eine Postgres-Funktion ersetzbar (sauberer, manipulationssicher).
 */

type Pruefung = Tables<'pruefung'>

interface Auswahl {
  frage_id: string
  themengebiet_id: string
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Pool des Kurses je Themengebiet (Liste von frage-IDs). */
async function ladePoolProThema(kursId: string): Promise<Map<string, string[]>> {
  const { data, error } = await supabase
    .from('frage')
    .select('id, themengebiet_id')
    .eq('kurs_id', kursId)
  if (error) throw error
  const map = new Map<string, string[]>()
  for (const f of data ?? []) {
    if (!f.themengebiet_id) continue
    const liste = map.get(f.themengebiet_id) ?? []
    liste.push(f.id)
    map.set(f.themengebiet_id, liste)
  }
  return map
}

/** Zieht gemäß Vorlage je Themengebiet zufällig Fragen. Wirft, wenn der Pool nicht reicht. */
async function zieheAuswahl(kursId: string, vorlageId: string): Promise<Auswahl[]> {
  const { data: vt, error } = await supabase
    .from('vorlage_themengebiet')
    .select('themengebiet_id, anzahl_fragen, themengebiet(name, sortierung)')
    .eq('vorlage_id', vorlageId)
    .returns<
      {
        themengebiet_id: string
        anzahl_fragen: number
        themengebiet: { name: string; sortierung: number } | null
      }[]
    >()
  if (error) throw error
  if (!vt || vt.length === 0)
    throw new Error('Die Vorlage hat keine Themengebiete mit Fragen.')

  const pool = await ladePoolProThema(kursId)
  // nach Themengebiet-Sortierung ordnen, damit der Snapshot stabil gruppiert ist
  const sortiert = [...vt].sort(
    (a, b) => (a.themengebiet?.sortierung ?? 0) - (b.themengebiet?.sortierung ?? 0),
  )

  const auswahl: Auswahl[] = []
  for (const zeile of sortiert) {
    const verfuegbar = pool.get(zeile.themengebiet_id) ?? []
    if (verfuegbar.length < zeile.anzahl_fragen) {
      const name = zeile.themengebiet?.name ?? 'Themengebiet'
      throw new Error(
        `„${name}": ${zeile.anzahl_fragen} Fragen benötigt, aber nur ${verfuegbar.length} im Pool.`,
      )
    }
    for (const frageId of shuffle(verfuegbar).slice(0, zeile.anzahl_fragen)) {
      auswahl.push({ frage_id: frageId, themengebiet_id: zeile.themengebiet_id })
    }
  }
  return auswahl
}

async function schreibeSnapshot(pruefungId: string, auswahl: Auswahl[]): Promise<void> {
  const rows = auswahl.map((a, i) => ({
    pruefung_id: pruefungId,
    frage_id: a.frage_id,
    themengebiet_id: a.themengebiet_id,
    sortierung: i,
  }))
  const { error } = await supabase.from('pruefung_frage').insert(rows)
  if (error) throw error
}

/** Legt eine Prüfung (Status entwurf) inkl. Fragen-Snapshot an. */
export async function erstellePruefung(opts: {
  vorlageId: string
  kursId: string
  ownerId: string
  datum: string | null
  lateJoinModus: 'zeit_reduziert' | 'volle_zeit' | 'gesperrt'
  uebungsmodus?: boolean
}): Promise<Pruefung> {
  const auswahl = await zieheAuswahl(opts.kursId, opts.vorlageId)

  // Übungsmodus: dauerhaft offen -> direkt als "läuft" markieren (kein Trainer-Start nötig)
  const basis = {
    vorlage_id: opts.vorlageId,
    owner_id: opts.ownerId,
    datum: opts.datum,
    late_join_modus: opts.lateJoinModus,
  }
  const insertDaten = opts.uebungsmodus
    ? {
        ...basis,
        uebungsmodus: true,
        status: 'laeuft',
        start_zeit: new Date().toISOString(),
        end_zeit: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      }
    : { ...basis, status: 'entwurf' }

  const { data: pruefung, error } = await supabase
    .from('pruefung')
    .insert(insertDaten)
    .select('*')
    .single()
  if (error) throw error

  await schreibeSnapshot(pruefung.id, auswahl)
  return pruefung
}

/** Komplette Fragenauswahl neu würfeln (nur im Entwurf sinnvoll). */
export async function wuerfleNeu(
  pruefungId: string,
  kursId: string,
  vorlageId: string,
): Promise<void> {
  const auswahl = await zieheAuswahl(kursId, vorlageId)
  const { error } = await supabase
    .from('pruefung_frage')
    .delete()
    .eq('pruefung_id', pruefungId)
  if (error) throw error
  await schreibeSnapshot(pruefungId, auswahl)
}

/**
 * Eine einzelne Frage im Snapshot gegen eine andere zufällige Frage desselben
 * Themengebiets tauschen (die noch nicht im Snapshot ist).
 */
export async function tauscheFrage(
  pruefungFrageId: string,
  kursId: string,
  themengebietId: string,
  bereitsImSnapshot: string[],
): Promise<string> {
  const pool = await ladePoolProThema(kursId)
  const kandidaten = (pool.get(themengebietId) ?? []).filter(
    (id) => !bereitsImSnapshot.includes(id),
  )
  if (kandidaten.length === 0)
    throw new Error('Keine weitere Frage in diesem Themengebiet verfügbar.')
  const neueFrageId = shuffle(kandidaten)[0]
  const { error } = await supabase
    .from('pruefung_frage')
    .update({ frage_id: neueFrageId })
    .eq('id', pruefungFrageId)
  if (error) throw error
  return neueFrageId
}
