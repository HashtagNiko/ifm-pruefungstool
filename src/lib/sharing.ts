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

/** Map kurs_id -> Modus für angenommene Freigaben an den aktuellen Trainer. */
export async function meineFreigegebenenKurse(
  empfaengerId: string,
): Promise<Record<string, FreigabeModus>> {
  const { data, error } = await supabase
    .from('kurs_freigabe')
    .select('kurs_id, modus')
    .eq('empfaenger_id', empfaengerId)
    .eq('status', 'angenommen')
  if (error || !data) return {}
  const map: Record<string, FreigabeModus> = {}
  for (const f of data) {
    if (f.modus !== 'kopie') map[f.kurs_id] = f.modus as FreigabeModus
  }
  return map
}

/* ===================== Prüfungs-Freigaben ===================== */

export type PruefungFreigabeModus = 'eingeschraenkt' | 'kopie'

export const PRUEFUNG_MODUS_LABEL: Record<PruefungFreigabeModus, string> = {
  eingeschraenkt: 'Eingeschränkt nutzen',
  kopie: 'Kopie übernehmen',
}

export const PRUEFUNG_MODUS_BESCHREIBUNG: Record<PruefungFreigabeModus, string> = {
  eingeschraenkt:
    'Erhält eine eigene Prüfung mit deinen Fragen. Eigene Teilnehmer möglich, ' +
    'aber Fragen nur in den von dir freigegebenen Themengebieten austauschbar.',
  kopie:
    'Erhält eine vollständige eigene Kopie (Kurs, Fragenpool, Vorlage und diese Prüfung) ' +
    'und kann danach alles selbst bearbeiten.',
}

export async function pruefungTeilen(
  pruefungId: string,
  email: string,
  modus: PruefungFreigabeModus,
  themengebiete: string[],
): Promise<void> {
  const { error } = await supabase.rpc('pruefung_teilen', {
    p_pruefung_id: pruefungId,
    p_email: email,
    p_modus: modus,
    p_themengebiete: modus === 'eingeschraenkt' ? themengebiete : [],
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
