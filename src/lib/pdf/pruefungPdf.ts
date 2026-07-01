import pdfMake from 'pdfmake/build/pdfmake'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import JSZip from 'jszip'
import { ensureFonts, ladeLogoDataUrl } from './fontsUndLogo'
import {
  ladeAuswertungsdaten,
  feedbackKey,
  type AuswertungsDaten,
} from './auswertungsdaten'
import type { FrageAuswertung } from '../auswertung'

const FARBE = {
  blau: '#00444A', // Dunkel-Petrol — Primärfarbe (ifmera academy)
  rot: '#FF7758', // Koralle — Akzent / "falsch"
  gruen: '#1BA56E', // Grün — Erfolg / "richtig"
  hellblau: '#DCE9E9', // Helles Teal — Boxen / Tabellenfüllung
  grau: '#6F8587', // Teal-Grau — Sekundärtext
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// Schriftunabhängige Icons als SVG (Ubuntu hat keine ✓/✗-Glyphen)
function boxSvg(typ: 'leer' | 'check' | 'kreuz'): string {
  const rahmen =
    typ === 'check' ? FARBE.gruen : typ === 'kreuz' ? FARBE.rot : FARBE.grau
  const rect = `<rect x="1" y="1" width="12" height="12" rx="2.5" fill="none" stroke="${rahmen}" stroke-width="1.4"/>`
  const mark =
    typ === 'check'
      ? `<path d="M3.5 7.3 L6 9.7 L10.5 4.3" fill="none" stroke="${FARBE.gruen}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
      : typ === 'kreuz'
        ? `<path d="M4 4 L10 10 M10 4 L4 10" stroke="${FARBE.rot}" stroke-width="1.8" stroke-linecap="round"/>`
        : ''
  return `<svg width="14" height="14" viewBox="0 0 14 14">${rect}${mark}</svg>`
}

function statusSvg(bestanden: boolean): string {
  return bestanden
    ? `<svg width="13" height="13" viewBox="0 0 14 14"><path d="M2 7.5 L5.5 11 L12 3.5" fill="none" stroke="${FARBE.gruen}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 14 14"><path d="M3 3 L11 11 M11 3 L3 11" stroke="${FARBE.rot}" stroke-width="2" stroke-linecap="round"/></svg>`
}

function feedbackBox(text: string | undefined): any[] {
  if (!text || !text.trim()) return []
  return [
    {
      table: {
        widths: ['*'],
        body: [
          [{ text: text.trim(), color: FARBE.blau, fillColor: FARBE.hellblau, margin: [8, 6, 8, 6] }],
        ],
      },
      layout: 'noBorders',
      margin: [0, 4, 0, 8],
    },
  ]
}

function optionZeile(opt: { id: string; text: string; ist_richtig: boolean }, gewaehlt: boolean) {
  const falschGewaehlt = gewaehlt && !opt.ist_richtig
  const boxTyp = gewaehlt && opt.ist_richtig ? 'check' : falschGewaehlt ? 'kreuz' : 'leer'
  // Richtige Antwort immer grün; falsch gewählte rot; sonst neutral
  const textFarbe = opt.ist_richtig ? FARBE.gruen : falschGewaehlt ? FARBE.rot : FARBE.blau
  return {
    columns: [
      { svg: boxSvg(boxTyp), width: 16 },
      { text: opt.text, color: textFarbe },
    ],
    columnGap: 8,
    margin: [0, 1.5, 0, 1.5],
  }
}

/** Detailblöcke gruppiert nach Themengebiet, Fragen in ursprünglicher Anlegereihenfolge. */
function detailInhalt(daten: AuswertungsDaten): any[] {
  const sortiert: FrageAuswertung[] = [...daten.auswertung.proFrage].sort((a, b) => {
    const tg = (a.frage.themengebiet_sortierung ?? 0) - (b.frage.themengebiet_sortierung ?? 0)
    if (tg !== 0) return tg
    return (a.frage.erstellt_am ?? '').localeCompare(b.frage.erstellt_am ?? '')
  })

  const inhalt: any[] = []
  let aktuellesTg: string | null = null
  let nr = 0

  sortiert.forEach((fa, i) => {
    const tgKey = fa.frage.themengebiet_id ?? '∅'
    if (tgKey !== aktuellesTg) {
      aktuellesTg = tgKey
      inhalt.push({
        text: fa.frage.themengebiet_name,
        bold: true,
        fontSize: 14,
        color: FARBE.blau,
        margin: [0, i === 0 ? 0 : 10, 0, 2],
      })
      // Wer hat dieses Themengebiet korrigiert?
      const korr = fa.frage.themengebiet_id
        ? daten.korrekturProThemengebiet[fa.frage.themengebiet_id]
        : undefined
      inhalt.push({
        text: korr ? `korrigiert von ${korr}` : 'noch nicht korrigiert',
        italics: true,
        fontSize: 9,
        color: korr ? FARBE.gruen : FARBE.grau,
        margin: [0, 0, 0, 6],
      })
    }
    nr += 1
    inhalt.push({
      text: [{ text: `${nr}. `, bold: true }, fa.frage.text],
      color: FARBE.blau,
      margin: [0, 6, 0, 4],
    })
    fa.frage.optionen.forEach((opt) =>
      inhalt.push(optionZeile(opt, fa.gewaehlt.includes(opt.id))),
    )
    inhalt.push({
      text: `Punkte: ${fa.punkte} / ${fa.max}`,
      bold: true,
      alignment: 'right',
      color: fa.punkte === fa.max ? FARBE.gruen : fa.punkte === 0 ? FARBE.rot : FARBE.blau,
      margin: [0, 3, 0, 4],
    })
    inhalt.push(...feedbackBox(daten.feedback[feedbackKey('frage', fa.frage.frage_id)]))
  })

  return inhalt
}

function baueDocDefinition(daten: AuswertungsDaten, logoDataUrl: string): TDocumentDefinitions {
  const a = daten.auswertung
  const datumText = daten.datum
    ? new Date(daten.datum).toLocaleDateString('de-DE')
    : ''

  const themengebietTabelle = {
    table: {
      headerRows: 1,
      widths: ['*', 'auto', 'auto', 'auto', 'auto'],
      body: [
        [
          { text: 'Themengebiet', bold: true, color: FARBE.blau },
          { text: 'Punkte', bold: true, color: FARBE.blau, alignment: 'right' },
          { text: 'Max', bold: true, color: FARBE.blau, alignment: 'right' },
          { text: 'Prozent', bold: true, color: FARBE.blau, alignment: 'right' },
          { text: 'Bestanden', bold: true, color: FARBE.blau, alignment: 'center' },
        ],
        ...a.proThemengebiet.map((t) => [
          { text: t.name, color: FARBE.blau },
          { text: String(t.punkte), alignment: 'right', color: FARBE.blau },
          { text: String(t.max), alignment: 'right', color: FARBE.grau },
          { text: `${t.prozent} %`, alignment: 'right', color: FARBE.blau },
          daten.schwelleProThema == null
            ? { text: '–', alignment: 'center', color: FARBE.grau }
            : { svg: statusSvg(t.bestanden), alignment: 'center' },
        ]),
        // Gesamt-Summenzeile (spaltenbündig)
        [
          { text: 'Gesamt', bold: true, color: FARBE.blau, fillColor: FARBE.hellblau },
          { text: String(a.punkteGesamt), bold: true, alignment: 'right', color: FARBE.blau, fillColor: FARBE.hellblau },
          { text: String(a.punkteMax), bold: true, alignment: 'right', color: FARBE.blau, fillColor: FARBE.hellblau },
          { text: `${a.prozentGesamt} %`, bold: true, alignment: 'right', color: FARBE.blau, fillColor: FARBE.hellblau },
          { svg: statusSvg(a.bestanden), alignment: 'center', fillColor: FARBE.hellblau },
        ],
      ],
    },
    layout: {
      hLineColor: () => FARBE.hellblau,
      vLineColor: () => FARBE.hellblau,
    },
    margin: [0, 8, 0, 12] as [number, number, number, number],
  }

  return {
    pageSize: 'A4',
    pageMargins: [40, 90, 40, 60],
    defaultStyle: { font: 'Ubuntu', fontSize: 12, color: FARBE.blau },
    header: () => ({
      margin: [40, 22, 40, 0],
      image: logoDataUrl,
      fit: [150, 50],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      margin: [40, 10, 40, 0],
      columns: [
        { text: '© ifmera academy GmbH', fontSize: 9, color: FARBE.grau },
        { text: daten.trainerName, fontSize: 9, color: FARBE.grau, alignment: 'center' },
        { text: `Seite ${currentPage} von ${pageCount}`, fontSize: 9, color: FARBE.grau, alignment: 'right' },
      ],
    }),
    content: [
      { text: `Prüfungsauswertung ${daten.kursName}`, fontSize: 24, bold: true, color: FARBE.blau },
      ...(datumText ? [{ text: datumText, color: FARBE.grau, margin: [0, 2, 0, 0] as [number, number, number, number] }] : []),
      { text: 'Teilnehmer', bold: true, color: FARBE.blau, margin: [0, 14, 0, 0] },
      { text: daten.teilnehmerName, margin: [0, 0, 0, 4] },
      themengebietTabelle,
      {
        text: a.bestanden ? 'Gesamtergebnis: bestanden' : 'Gesamtergebnis: nicht bestanden',
        fontSize: 16,
        bold: true,
        color: a.bestanden ? FARBE.gruen : FARBE.rot,
        margin: [0, 6, 0, 8],
      },
      ...feedbackBox(daten.feedback[feedbackKey('gesamt', null)]),
      { text: 'Fragen', fontSize: 16, bold: true, color: FARBE.blau, pageBreak: 'before', margin: [0, 0, 0, 4] },
      ...detailInhalt(daten),
    ],
  }
}

function sichererName(s: string): string {
  return s.replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '').replace(/\s+/g, '_').slice(0, 80)
}

export function dateiname(daten: AuswertungsDaten): string {
  return `Auswertung_${sichererName(daten.kursName)}_${sichererName(daten.teilnehmerName)}.pdf`
}

async function baueBlob(daten: AuswertungsDaten): Promise<Blob> {
  await ensureFonts() // registriert vfs + Ubuntu-Fonts bei pdfmake
  const logo = await ladeLogoDataUrl()
  const doc = baueDocDefinition(daten, logo)
  // pdfmake 0.3: getBlob() ist Promise-basiert (kein Callback)
  const created = pdfMake.createPdf(doc)
  const ergebnis = (created as any).getBlob()
  if (ergebnis && typeof ergebnis.then === 'function') return await ergebnis
  // Fallback für ältere Callback-API
  return await new Promise<Blob>((resolve) => (created as any).getBlob((b: Blob) => resolve(b)))
}

function speichereBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

/** Einzelnes Teilnehmer-PDF erzeugen und herunterladen. */
export async function ladeUndErzeugePdf(pruefungId: string, teilnehmerId: string): Promise<void> {
  const daten = await ladeAuswertungsdaten(pruefungId, teilnehmerId)
  const blob = await baueBlob(daten)
  speichereBlob(blob, dateiname(daten))
}

/** Alle (abgegebenen) Teilnehmer als ZIP mit je einem PDF. */
export async function erzeugeZip(
  pruefungId: string,
  teilnehmer: { id: string; name: string }[],
  dateinameZip: string,
): Promise<void> {
  const zip = new JSZip()
  for (const t of teilnehmer) {
    const daten = await ladeAuswertungsdaten(pruefungId, t.id)
    const blob = await baueBlob(daten)
    zip.file(dateiname(daten), blob)
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  speichereBlob(zipBlob, dateinameZip)
}
