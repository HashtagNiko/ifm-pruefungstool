import { supabase } from './supabase'
import type { TablesInsert } from './database.types'

/**
 * Import-Logik für das Export-Format des bisherigen Tools:
 * { formTitel, exportiertAm, fragen: [{ nr, themengebiet, text, typ, punkte_max, antworten:[{text, ist_richtig}] }] }
 */

export interface ParsedAntwort {
  text: string
  ist_richtig: boolean
}

export interface ParsedFrage {
  nr?: number
  themengebiet: string
  text: string
  typ: 'single' | 'multi'
  antworten: ParsedAntwort[]
}

export interface ParsedExport {
  formTitel?: string
  fragen: ParsedFrage[]
}

export interface ParseErgebnis {
  daten: ParsedExport | null
  /** harte Fehler -> Import nicht möglich */
  fehler: string[]
  /** weiche Hinweise (z. B. Punkteschema-Abweichung) -> Import möglich */
  warnungen: string[]
}

/** Liest und validiert den JSON-Export. */
export function parseExport(text: string): ParseErgebnis {
  const fehler: string[] = []
  const warnungen: string[] = []

  let roh: unknown
  try {
    roh = JSON.parse(text)
  } catch {
    return { daten: null, fehler: ['Die Datei ist kein gültiges JSON.'], warnungen }
  }

  if (typeof roh !== 'object' || roh === null || !Array.isArray((roh as ParsedExport).fragen)) {
    return {
      daten: null,
      fehler: ['Unerwartetes Format: Es wird ein Objekt mit einem Feld „fragen" (Array) erwartet.'],
      warnungen,
    }
  }

  const quelle = roh as ParsedExport
  const fragen: ParsedFrage[] = []

  quelle.fragen.forEach((f, i) => {
    const pos = `Frage ${f?.nr ?? i + 1}`
    if (!f || typeof f.text !== 'string' || !f.text.trim()) {
      fehler.push(`${pos}: fehlender Fragetext.`)
      return
    }
    if (f.typ !== 'single' && f.typ !== 'multi') {
      fehler.push(`${pos}: ungültiger Typ „${f.typ}" (erlaubt: single, multi).`)
      return
    }
    if (!Array.isArray(f.antworten) || f.antworten.length < 2) {
      fehler.push(`${pos}: mindestens zwei Antwortoptionen nötig.`)
      return
    }
    if (typeof f.themengebiet !== 'string' || !f.themengebiet.trim()) {
      fehler.push(`${pos}: fehlendes Themengebiet.`)
      return
    }
    const richtige = f.antworten.filter((a) => a.ist_richtig).length
    if (f.typ === 'single' && richtige !== 1) {
      warnungen.push(`${pos} (single): hat ${richtige} richtige Antworten, erwartet genau 1.`)
    }
    if (f.typ === 'multi' && richtige !== 2) {
      warnungen.push(`${pos} (multi): hat ${richtige} richtige Antworten, erwartet genau 2.`)
    }
    fragen.push({
      nr: f.nr,
      themengebiet: f.themengebiet.trim(),
      text: f.text.trim(),
      typ: f.typ,
      antworten: f.antworten.map((a) => ({
        text: String(a.text ?? '').trim(),
        ist_richtig: Boolean(a.ist_richtig),
      })),
    })
  })

  if (fragen.length === 0 && fehler.length === 0) {
    fehler.push('Keine Fragen in der Datei gefunden.')
  }

  return {
    daten: fehler.length === 0 ? { formTitel: quelle.formTitel, fragen } : null,
    fehler,
    warnungen,
  }
}

export interface ImportErgebnis {
  anzahlFragen: number
  neueThemengebiete: string[]
}

/**
 * Importiert die Fragen in den Kurs:
 * - fehlende Themengebiete (nach Name) werden angelegt
 * - Fragen + Antwortoptionen werden gebündelt eingefügt (Client-seitige UUIDs)
 * Bestehende Fragen bleiben unberührt (Import hängt an).
 */
export async function importFragen(
  kursId: string,
  fragen: ParsedFrage[],
): Promise<ImportErgebnis> {
  // 1) Vorhandene Themengebiete laden
  const { data: vorhandene, error: tgErr } = await supabase
    .from('themengebiet')
    .select('id, name, sortierung')
    .eq('kurs_id', kursId)
  if (tgErr) throw tgErr

  const nameZuId = new Map<string, string>()
  let maxSortierung = -1
  for (const t of vorhandene ?? []) {
    nameZuId.set(t.name, t.id)
    if (t.sortierung > maxSortierung) maxSortierung = t.sortierung
  }

  // 2) Fehlende Themengebiete anlegen
  const benoetigt = Array.from(new Set(fragen.map((f) => f.themengebiet)))
  const fehlend = benoetigt.filter((name) => !nameZuId.has(name))
  if (fehlend.length > 0) {
    const neueRows: TablesInsert<'themengebiet'>[] = fehlend.map((name, i) => ({
      kurs_id: kursId,
      name,
      sortierung: maxSortierung + 1 + i,
    }))
    const { data: angelegt, error } = await supabase
      .from('themengebiet')
      .insert(neueRows)
      .select('id, name')
    if (error) throw error
    for (const t of angelegt ?? []) nameZuId.set(t.name, t.id)
  }

  // 3) Fragen + Optionen mit Client-UUIDs aufbauen
  const frageRows: TablesInsert<'frage'>[] = []
  const optionRows: TablesInsert<'antwortoption'>[] = []
  for (const f of fragen) {
    const frageId = crypto.randomUUID()
    frageRows.push({
      id: frageId,
      kurs_id: kursId,
      themengebiet_id: nameZuId.get(f.themengebiet) ?? null,
      text: f.text,
      typ: f.typ,
    })
    f.antworten.forEach((a, idx) => {
      optionRows.push({
        frage_id: frageId,
        text: a.text,
        ist_richtig: a.ist_richtig,
        sortierung: idx,
      })
    })
  }

  // 4) Gebündelt einfügen
  const { error: fErr } = await supabase.from('frage').insert(frageRows)
  if (fErr) throw fErr
  const { error: oErr } = await supabase.from('antwortoption').insert(optionRows)
  if (oErr) throw oErr

  return { anzahlFragen: frageRows.length, neueThemengebiete: fehlend }
}
