import { supabaseP } from './supabaseParticipant'

/** Typen der RPC-Antworten (jsonb wird hier konkretisiert). */

export interface StatusInfo {
  status: 'entwurf' | 'lobby' | 'laeuft' | 'beendet'
  start_zeit: string | null
  end_zeit: string | null
  late_join_modus: 'zeit_reduziert' | 'volle_zeit' | 'gesperrt'
  dauer_minuten: number
  vorlage_name: string
  kurs_name: string
  uebungsmodus: boolean
}

export interface BeitretenInfo {
  teilnehmer_id: string
  name: string
  status: StatusInfo['status']
  abgegeben: boolean
}

export interface TeilnehmerOption {
  id: string
  text: string
}

export interface TeilnehmerFrage {
  pruefung_frage_id: string
  sortierung: number
  typ: 'single' | 'multi'
  text: string
  themengebiet: string | null
  optionen: TeilnehmerOption[]
}

export interface GespeicherteAntwort {
  pruefung_frage_id: string
  optionen: string[]
  unsicher: boolean
}

export interface FragenInfo {
  status: StatusInfo['status']
  end_zeit: string | null
  abgegeben: boolean
  fragen: TeilnehmerFrage[]
  antworten: GespeicherteAntwort[]
}

export interface ErgebnisInfo {
  punkte_gesamt: number
  punkte_max: number
  prozent: number
}

export async function statusLaden(code: string): Promise<StatusInfo> {
  const { data, error } = await supabaseP.rpc('pruefung_status', { p_code: code })
  if (error) throw new Error(error.message)
  return data as unknown as StatusInfo
}

export async function beitreten(code: string, name: string): Promise<BeitretenInfo> {
  const { data, error } = await supabaseP.rpc('pruefung_beitreten', {
    p_code: code,
    p_name: name,
  })
  if (error) throw new Error(error.message)
  return data as unknown as BeitretenInfo
}

export async function fragenLaden(teilnehmerId: string): Promise<FragenInfo> {
  const { data, error } = await supabaseP.rpc('pruefung_fragen', {
    p_teilnehmer_id: teilnehmerId,
  })
  if (error) throw new Error(error.message)
  return data as unknown as FragenInfo
}

export async function antwortSpeichern(
  teilnehmerId: string,
  pruefungFrageId: string,
  optionen: string[],
  unsicher: boolean,
): Promise<void> {
  const { error } = await supabaseP.rpc('antwort_speichern', {
    p_teilnehmer_id: teilnehmerId,
    p_pruefung_frage_id: pruefungFrageId,
    p_optionen: optionen,
    p_unsicher: unsicher,
  })
  if (error) throw new Error(error.message)
}

export async function abgeben(teilnehmerId: string): Promise<ErgebnisInfo> {
  const { data, error } = await supabaseP.rpc('pruefung_abgeben', {
    p_teilnehmer_id: teilnehmerId,
  })
  if (error) throw new Error(error.message)
  return data as unknown as ErgebnisInfo
}
