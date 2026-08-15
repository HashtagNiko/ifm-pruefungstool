import { supabase } from './supabase'

export type FreigabeModus = 'nur_verwenden' | 'gemeinsam' | 'kopie'

export const MODUS_LABEL: Record<FreigabeModus, string> = {
  nur_verwenden: 'Nur verwenden',
  gemeinsam: 'Gemeinsam bearbeiten',
  kopie: 'Kopie übernehmen',
}

export const MODUS_BESCHREIBUNG: Record<FreigabeModus, string> = {
  nur_verwenden:
    'Sieht den Kurs und kann eigene Prüfungen damit erstellen. Inhalt nicht änderbar.',
  gemeinsam: 'Beide bearbeiten denselben Kurs; alle Änderungen sind für beide sichtbar.',
  kopie: 'Erhält eine eigenständige Kopie im eigenen Konto.',
}

export async function kursTeilen(
  kursId: string,
  email: string,
  modus: FreigabeModus,
): Promise<void> {
  const { error } = await supabase.rpc('kurs_teilen', {
    p_kurs_id: kursId,
    p_email: email,
    p_modus: modus,
  })
  if (error) throw new Error(error.message)
}

export async function freigabeAnnehmen(freigabeId: string): Promise<void> {
  const { error } = await supabase.rpc('freigabe_annehmen', { p_freigabe_id: freigabeId })
  if (error) throw new Error(error.message)
}

export async function freigabeAblehnen(freigabeId: string): Promise<void> {
  const { error } = await supabase.rpc('freigabe_ablehnen', { p_freigabe_id: freigabeId })
  if (error) throw new Error(error.message)
}

export type KursFreigabeInfo = { freigabeId: string; modus: FreigabeModus }

/** Map kurs_id -> Freigabe für angenommene Freigaben an den aktuellen Trainer. */
export async function meineFreigegebenenKurse(
  empfaengerId: string,
): Promise<Record<string, KursFreigabeInfo>> {
  const { data, error } = await supabase
    .from('kurs_freigabe')
    .select('id, kurs_id, modus')
    .eq('empfaenger_id', empfaengerId)
    .eq('status', 'angenommen')
  if (error || !data) return {}
  const map: Record<string, KursFreigabeInfo> = {}
  for (const f of data) {
    if (f.modus !== 'kopie') {
      map[f.kurs_id] = { freigabeId: f.id, modus: f.modus as FreigabeModus }
    }
  }
  return map
}

/* ===================== Prüfungs-Freigaben ===================== */

export type PruefungFreigabeModus = 'eingeschraenkt' | 'kopie' | 'korrektur'

export const PRUEFUNG_MODUS_LABEL: Record<PruefungFreigabeModus, string> = {
  eingeschraenkt: 'Eingeschränkt nutzen',
  kopie: 'Kopie übernehmen',
  korrektur: 'Gemeinsam korrigieren',
}

export const PRUEFUNG_MODUS_BESCHREIBUNG: Record<PruefungFreigabeModus, string> = {
  eingeschraenkt:
    'Erhält eine eigene Prüfung mit deinen Fragen. Eigene Teilnehmer möglich, ' +
    'aber Fragen nur in den von dir freigegebenen Themengebieten austauschbar.',
  kopie:
    'Erhält eine vollständige eigene Kopie (Kurs, Fragenpool, Vorlage und diese Prüfung) ' +
    'und kann danach alles selbst bearbeiten.',
  korrektur:
    'Keine Kopie: Beide arbeiten an DERSELBEN Prüfung. Der eingeladene Trainer korrigiert ' +
    'seine zugewiesenen Themengebiete (Feedback + Korrektur-Status), sichtbar für beide.',
}

export async function pruefungTeilen(
  pruefungId: string,
  email: string,
  modus: PruefungFreigabeModus,
  themengebiete: string[],
  empfaengerLeitet = false,
): Promise<void> {
  const { error } = await supabase.rpc('pruefung_teilen', {
    p_pruefung_id: pruefungId,
    p_email: email,
    p_modus: modus,
    p_themengebiete: modus === 'kopie' ? [] : themengebiete,
    p_empfaenger_leitet: modus === 'korrektur' ? empfaengerLeitet : false,
  })
  if (error) throw new Error(error.message)
}

export async function pruefungFreigabeAnnehmen(freigabeId: string): Promise<void> {
  const { error } = await supabase.rpc('pruefung_freigabe_annehmen', {
    p_freigabe_id: freigabeId,
  })
  if (error) throw new Error(error.message)
}

export async function pruefungFreigabeAblehnen(freigabeId: string): Promise<void> {
  const { error } = await supabase.rpc('pruefung_freigabe_ablehnen', {
    p_freigabe_id: freigabeId,
  })
  if (error) throw new Error(error.message)
}

/** Kopiert den kompletten Kurs (inkl. Pool, Vorlage, dieser Prüfung) in das eigene Konto. */
export async function geteiltePruefungKursKopieren(freigabeId: string): Promise<void> {
  const { error } = await supabase.rpc('geteilte_pruefung_kurs_kopieren', {
    p_freigabe_id: freigabeId,
  })
  if (error) throw new Error(error.message)
}
