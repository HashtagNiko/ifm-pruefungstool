import { supabase } from '../supabase'
import { werteAus, type FrageDaten, type GesamtAuswertung } from '../auswertung'
import { trainerAnzeigeName } from '../trainerName'

export function feedbackKey(ebene: string, bezugId: string | null): string {
  return `${ebene}:${bezugId ?? ''}`
}

export interface AuswertungsDaten {
  teilnehmerId: string
  teilnehmerName: string
  kursName: string
  vorlageName: string
  datum: string | null
  trainerName: string
  abgegeben: boolean
  schwelleGesamt: number
  schwelleProThema: number | null
  auswertung: GesamtAuswertung
  /** key = `${ebene}:${bezugId ?? ''}` -> Text */
  feedback: Record<string, string>
  /** themengebiet_id -> Name des korrigierenden Trainers */
  korrekturProThemengebiet: Record<string, string>
}

/** Lädt alle Daten einer Teilnehmer-Auswertung und berechnet die Punkte. */
export async function ladeAuswertungsdaten(
  pruefungId: string,
  teilnehmerId: string,
): Promise<AuswertungsDaten> {
  const [tnRes, prRes, snapRes, antRes, fbRes] = await Promise.all([
    supabase.from('teilnehmer').select('name, abgegeben_am').eq('id', teilnehmerId).single(),
    supabase
      .from('pruefung')
      .select(
        'datum, owner_id, pruefungsvorlage(name, bestehensschwelle_prozent, bestehensschwelle_pro_themengebiet_prozent, kurs(name))',
      )
      .eq('id', pruefungId)
      .single()
      .returns<{
        datum: string | null
        owner_id: string
        pruefungsvorlage: {
          name: string
          bestehensschwelle_prozent: number
          bestehensschwelle_pro_themengebiet_prozent: number | null
          kurs: { name: string } | null
        } | null
      }>(),
    supabase
      .from('pruefung_frage')
      .select(
        'id, sortierung, frage_id, themengebiet_id, frage(text, typ, erstellt_am), themengebiet(name, sortierung)',
      )
      .eq('pruefung_id', pruefungId)
      .order('sortierung', { ascending: true })
      .returns<
        {
          id: string
          sortierung: number
          frage_id: string
          themengebiet_id: string | null
          frage: { text: string; typ: string; erstellt_am: string } | null
          themengebiet: { name: string; sortierung: number } | null
        }[]
      >(),
    supabase
      .from('antwort')
      .select('pruefung_frage_id, ausgewaehlte_optionen, unsicher_markiert')
      .eq('teilnehmer_id', teilnehmerId),
    supabase.from('feedback').select('ebene, bezug_id, text').eq('teilnehmer_id', teilnehmerId),
  ])

  if (tnRes.error) throw tnRes.error
  if (prRes.error) throw prRes.error
  if (snapRes.error) throw snapRes.error
  if (antRes.error) throw antRes.error
  if (fbRes.error) throw fbRes.error

  const v = prRes.data.pruefungsvorlage
  const schwelleGesamt = v?.bestehensschwelle_prozent ?? 50
  const schwelleProThema = v?.bestehensschwelle_pro_themengebiet_prozent ?? null

  // Trainer-Name (Owner = aktueller Trainer)
  const { data: trainer } = await supabase
    .from('trainer')
    .select('vorname, nachname, name, email')
    .eq('id', prRes.data.owner_id)
    .maybeSingle()

  // Korrektur-Status je Themengebiet (wer hat korrigiert)
  const { data: korrektur } = await supabase
    .from('korrektur_status')
    .select('themengebiet_id, trainer_name')
    .eq('teilnehmer_id', teilnehmerId)
  const korrekturProThemengebiet: Record<string, string> = {}
  for (const k of korrektur ?? [])
    if (k.trainer_name) korrekturProThemengebiet[k.themengebiet_id] = k.trainer_name

  const snapshot = snapRes.data
  const frageIds = snapshot.map((s) => s.frage_id)
  const { data: optionen, error: optErr } = await supabase
    .from('antwortoption')
    .select('id, frage_id, text, ist_richtig, sortierung')
    .in('frage_id', frageIds)
  if (optErr) throw optErr

  const optProFrage = new Map<string, typeof optionen>()
  for (const o of optionen ?? []) {
    const liste = optProFrage.get(o.frage_id) ?? []
    liste.push(o)
    optProFrage.set(o.frage_id, liste)
  }

  const fragen: FrageDaten[] = snapshot.map((s) => ({
    pruefung_frage_id: s.id,
    frage_id: s.frage_id,
    themengebiet_id: s.themengebiet_id,
    themengebiet_name: s.themengebiet?.name ?? 'Ohne Themengebiet',
    themengebiet_sortierung: s.themengebiet?.sortierung ?? 0,
    sortierung: s.sortierung,
    erstellt_am: s.frage?.erstellt_am,
    text: s.frage?.text ?? '',
    typ: (s.frage?.typ as 'single' | 'multi') ?? 'single',
    optionen: (optProFrage.get(s.frage_id) ?? [])
      .slice()
      .sort((a, b) => a.sortierung - b.sortierung)
      .map((o) => ({
        id: o.id,
        text: o.text,
        ist_richtig: o.ist_richtig,
        sortierung: o.sortierung,
      })),
  }))

  const antwortenMap: Record<string, { optionen: string[]; unsicher: boolean }> = {}
  for (const a of antRes.data ?? []) {
    antwortenMap[a.pruefung_frage_id] = {
      optionen: a.ausgewaehlte_optionen ?? [],
      unsicher: a.unsicher_markiert,
    }
  }

  const feedback: Record<string, string> = {}
  for (const f of fbRes.data ?? []) {
    feedback[feedbackKey(f.ebene, f.bezug_id)] = f.text
  }

  return {
    teilnehmerId,
    teilnehmerName: tnRes.data.name,
    kursName: v?.kurs?.name ?? '',
    vorlageName: v?.name ?? 'Prüfung',
    datum: prRes.data.datum,
    trainerName: trainer ? trainerAnzeigeName(trainer) : '',
    abgegeben: tnRes.data.abgegeben_am != null,
    schwelleGesamt,
    schwelleProThema,
    auswertung: werteAus(fragen, antwortenMap, schwelleGesamt, schwelleProThema),
    feedback,
    korrekturProThemengebiet,
  }
}
