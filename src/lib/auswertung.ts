/**
 * Auswertungslogik (Trainer-Seite). Bewertet exakt nach IHK-Schema (Konzept Abschnitt 7) —
 * gleiche Regeln wie die serverseitige Berechnung, hier aber inkl. Lösung/Details für die
 * Anzeige und (später) den PDF-Export.
 */

export interface OptionDaten {
  id: string
  text: string
  ist_richtig: boolean
  sortierung: number
}

export interface FrageDaten {
  pruefung_frage_id: string
  frage_id: string
  themengebiet_id: string | null
  themengebiet_name: string
  sortierung: number
  text: string
  typ: 'single' | 'multi'
  optionen: OptionDaten[]
}

export interface FrageAuswertung {
  frage: FrageDaten
  gewaehlt: string[]
  unsicher: boolean
  punkte: number
  max: number
}

export interface ThemengebietAuswertung {
  id: string | null
  name: string
  punkte: number
  max: number
  prozent: number
  bestanden: boolean
}

export interface GesamtAuswertung {
  proFrage: FrageAuswertung[]
  proThemengebiet: ThemengebietAuswertung[]
  punkteGesamt: number
  punkteMax: number
  prozentGesamt: number
  bestanden: boolean
}

/** Punkte einer einzelnen Frage nach IHK-Schema. */
export function bewerteFrage(
  frage: FrageDaten,
  gewaehlt: string[],
): { punkte: number; max: number } {
  const richtigeIds = new Set(frage.optionen.filter((o) => o.ist_richtig).map((o) => o.id))
  const n = gewaehlt.length
  const richtigGewaehlt = gewaehlt.filter((id) => richtigeIds.has(id)).length

  if (frage.typ === 'single') {
    return { punkte: n === 1 && richtigGewaehlt === 1 ? 1 : 0, max: 1 }
  }
  // multi: 0 oder >2 angekreuzt -> 0; sonst Anzahl richtig angekreuzter
  return { punkte: n >= 1 && n <= 2 ? richtigGewaehlt : 0, max: 2 }
}

function runde(n: number): number {
  return Math.round(n * 100) / 100
}

export function werteAus(
  fragen: FrageDaten[],
  antwortenMap: Record<string, { optionen: string[]; unsicher: boolean }>,
  schwelleGesamtProzent: number,
  schwelleProThemaProzent: number | null,
): GesamtAuswertung {
  const proFrage: FrageAuswertung[] = fragen.map((frage) => {
    const a = antwortenMap[frage.pruefung_frage_id]
    const gewaehlt = a?.optionen ?? []
    const { punkte, max } = bewerteFrage(frage, gewaehlt)
    return { frage, gewaehlt, unsicher: a?.unsicher ?? false, punkte, max }
  })

  // nach Themengebiet gruppieren (Reihenfolge über sortierung der Fragen)
  const reihenfolge: string[] = []
  const gruppen = new Map<string, ThemengebietAuswertung>()
  for (const fa of proFrage) {
    const key = fa.frage.themengebiet_id ?? '∅'
    if (!gruppen.has(key)) {
      reihenfolge.push(key)
      gruppen.set(key, {
        id: fa.frage.themengebiet_id,
        name: fa.frage.themengebiet_name,
        punkte: 0,
        max: 0,
        prozent: 0,
        bestanden: true,
      })
    }
    const g = gruppen.get(key)!
    g.punkte += fa.punkte
    g.max += fa.max
  }

  const proThemengebiet = reihenfolge.map((key) => {
    const g = gruppen.get(key)!
    g.prozent = g.max > 0 ? runde((100 * g.punkte) / g.max) : 0
    g.bestanden = schwelleProThemaProzent == null ? true : g.prozent >= schwelleProThemaProzent
    return g
  })

  const punkteGesamt = proFrage.reduce((s, f) => s + f.punkte, 0)
  const punkteMax = proFrage.reduce((s, f) => s + f.max, 0)
  const prozentGesamt = punkteMax > 0 ? runde((100 * punkteGesamt) / punkteMax) : 0
  const alleThemenBestanden = proThemengebiet.every((t) => t.bestanden)
  const bestanden = prozentGesamt >= schwelleGesamtProzent && alleThemenBestanden

  return { proFrage, proThemengebiet, punkteGesamt, punkteMax, prozentGesamt, bestanden }
}
