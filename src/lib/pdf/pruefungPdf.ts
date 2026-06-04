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
  blau: '#2A4566',
  rot: '#AD0131',
  gruen: '#1BA56E',
  hellblau: '#E1EAF5',
  grau: '#8293A7',
}

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  const symbol = opt.ist_richtig ? '✓' : falschGewaehlt ? '✗' : '○'
  const farbe = opt.ist_richtig ? FARBE.gruen : falschGewaehlt ? FARBE.rot : FARBE.grau
  return {
    columns: [
      { text: symbol, width: 14, color: farbe, bold: true },
      {
        text: opt.text + (gewaehlt ? '   (gewählt)' : ''),
        color: opt.ist_richtig ? FARBE.gruen : falschGewaehlt ? FARBE.rot : FARBE.blau,
      },
    ],
    margin: [0, 1, 0, 1],
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
  let gruppeTgId: string | null = null

  sortiert.forEach((fa, i) => {
    const tgKey = fa.frage.themengebiet_id ?? '∅'
    if (tgKey !== aktuellesTg) {
      // vorherige Themengebiet-Feedbackbox einfügen
      if (aktuellesTg !== null) {
        inhalt.push(...feedbackBox(daten.feedback[feedbackKey('themengebiet', gruppeTgId)]))
      }
      aktuellesTg = tgKey
      gruppeTgId = fa.frage.themengebiet_id
      inhalt.push({
        text: fa.frage.themengebiet_name,
        bold: true,
        fontSize: 14,
        color: FARBE.blau,
        margin: [0, i === 0 ? 0 : 10, 0, 6],
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
      color: fa.punkte === fa.max ? FARBE.gruen : fa.punkte === 0 ? FARBE.rot : FARBE.blau,
      margin: [0, 3, 0, 4],
    })
    inhalt.push(...feedbackBox(daten.feedback[feedbackKey('frage', fa.frage.frage_id)]))
  })

  // letztes Themengebiet-Feedback
  if (aktuellesTg !== null) {
    inhalt.push(...feedbackBox(daten.feedback[feedbackKey('themengebiet', gruppeTgId)]))
  }
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
          {
            text: daten.schwelleProThema == null ? '–' : t.bestanden ? '✓' : '✗',
            alignment: 'center',
            bold: true,
            color: daten.schwelleProThema == null ? FARBE.grau : t.bestanden ? FARBE.gruen : FARBE.rot,
          },
        ]),
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
      margin: [40, 20, 40, 0],
      columns: [
        { image: logoDataUrl, width: 90, fit: [90, 40] },
        {
          alignment: 'right',
          margin: [0, 8, 0, 0],
          text: [
            { text: 'Qualifizierung', color: FARBE.blau, bold: true },
            { text: ' | ', color: FARBE.rot, bold: true },
            { text: 'Coaching', color: FARBE.blau, bold: true },
            { text: ' | ', color: FARBE.rot, bold: true },
            { text: 'Consulting', color: FARBE.blau, bold: true },
          ],
        },
      ],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      margin: [40, 10, 40, 0],
      stack: [
        {
          columns: [
            { text: '© IFM Institut für Managementberatung GmbH', fontSize: 9, color: FARBE.grau },
            { text: `Seite ${currentPage} von ${pageCount}`, fontSize: 9, color: FARBE.grau, alignment: 'right' },
          ],
        },
        {
          columns: [
            { text: daten.trainerName, fontSize: 9, color: FARBE.grau },
            { text: 'www.ifm-business.de', fontSize: 9, color: FARBE.blau, bold: true, alignment: 'right' },
          ],
          margin: [0, 2, 0, 0],
        },
      ],
    }),
    content: [
      { text: `Prüfungsauswertung ${daten.kursName}`, fontSize: 24, bold: true, color: FARBE.blau },
      ...(datumText ? [{ text: datumText, color: FARBE.grau, margin: [0, 2, 0, 0] as [number, number, number, number] }] : []),
      { text: 'Teilnehmer', bold: true, color: FARBE.blau, margin: [0, 14, 0, 0] },
      { text: daten.teilnehmerName, margin: [0, 0, 0, 4] },
      themengebietTabelle,
      {
        columns: [
          {
            text: a.bestanden ? 'Gesamtergebnis: bestanden' : 'Gesamtergebnis: nicht bestanden',
            fontSize: 16,
            bold: true,
            color: a.bestanden ? FARBE.gruen : FARBE.rot,
          },
          {
            text: `${a.punkteGesamt} / ${a.punkteMax}  ·  ${a.prozentGesamt} %`,
            alignment: 'right',
            bold: true,
            color: FARBE.blau,
          },
        ],
        margin: [0, 4, 0, 8],
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
  await ensureFonts()
  const logo = await ladeLogoDataUrl()
  const doc = baueDocDefinition(daten, logo)
  // pdfmake 0.3: getBlob() ist Promise-basiert (kein Callback)
  const created = pdfMake.createPdf(doc) as any
  const ergebnis = created.getBlob()
  if (ergebnis && typeof ergebnis.then === 'function') return await ergebnis
  // Fallback für ältere Callback-API
  return await new Promise<Blob>((resolve) => created.getBlob((b: Blob) => resolve(b)))
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
