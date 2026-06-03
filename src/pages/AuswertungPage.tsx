import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { Card, ErrorBanner, Textarea } from '../components/ui'
import {
  werteAus,
  type FrageDaten,
  type GesamtAuswertung,
} from '../lib/auswertung'

type Teilnehmer = Tables<'teilnehmer'>

interface FeedbackEintrag {
  id?: string
  text: string
}

export default function AuswertungPage() {
  const { id: pruefungId, teilnehmerId } = useParams<{ id: string; teilnehmerId: string }>()
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer | null>(null)
  const [vorlageName, setVorlageName] = useState('')
  const [kursName, setKursName] = useState('')
  const [schwelleGesamt, setSchwelleGesamt] = useState(50)
  const [schwelleProThema, setSchwelleProThema] = useState<number | null>(null)
  const [fragen, setFragen] = useState<FrageDaten[]>([])
  const [antwortenMap, setAntwortenMap] = useState<
    Record<string, { optionen: string[]; unsicher: boolean }>
  >({})
  const [feedback, setFeedback] = useState<Record<string, FeedbackEintrag>>({})
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    if (!pruefungId || !teilnehmerId) return
    ;(async () => {
      setLaden(true)
      try {
        const [tnRes, prRes, snapRes, antRes, fbRes] = await Promise.all([
          supabase.from('teilnehmer').select('*').eq('id', teilnehmerId).single(),
          supabase
            .from('pruefung')
            .select(
              'pruefungsvorlage(name, bestehensschwelle_prozent, bestehensschwelle_pro_themengebiet_prozent, kurs(name))',
            )
            .eq('id', pruefungId)
            .single()
            .returns<{
              pruefungsvorlage: {
                name: string
                bestehensschwelle_prozent: number
                bestehensschwelle_pro_themengebiet_prozent: number | null
                kurs: { name: string } | null
              } | null
            }>(),
          supabase
            .from('pruefung_frage')
            .select('id, sortierung, frage_id, themengebiet_id, frage(text, typ), themengebiet(name)')
            .eq('pruefung_id', pruefungId)
            .order('sortierung', { ascending: true })
            .returns<
              {
                id: string
                sortierung: number
                frage_id: string
                themengebiet_id: string | null
                frage: { text: string; typ: string } | null
                themengebiet: { name: string } | null
              }[]
            >(),
          supabase
            .from('antwort')
            .select('pruefung_frage_id, ausgewaehlte_optionen, unsicher_markiert')
            .eq('teilnehmer_id', teilnehmerId),
          supabase
            .from('feedback')
            .select('id, ebene, bezug_id, text')
            .eq('teilnehmer_id', teilnehmerId),
        ])

        if (tnRes.error) throw tnRes.error
        setTeilnehmer(tnRes.data)

        if (prRes.error) throw prRes.error
        const v = prRes.data.pruefungsvorlage
        setVorlageName(v?.name ?? 'Prüfung')
        setKursName(v?.kurs?.name ?? '')
        setSchwelleGesamt(v?.bestehensschwelle_prozent ?? 50)
        setSchwelleProThema(v?.bestehensschwelle_pro_themengebiet_prozent ?? null)

        if (snapRes.error) throw snapRes.error
        const snapshot = snapRes.data
        const frageIds = snapshot.map((s) => s.frage_id)

        // Optionen für alle Snapshot-Fragen laden
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

        const frageDaten: FrageDaten[] = snapshot.map((s) => ({
          pruefung_frage_id: s.id,
          frage_id: s.frage_id,
          themengebiet_id: s.themengebiet_id,
          themengebiet_name: s.themengebiet?.name ?? 'Ohne Themengebiet',
          sortierung: s.sortierung,
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
        setFragen(frageDaten)

        if (antRes.error) throw antRes.error
        const map: Record<string, { optionen: string[]; unsicher: boolean }> = {}
        for (const a of antRes.data ?? []) {
          map[a.pruefung_frage_id] = {
            optionen: a.ausgewaehlte_optionen ?? [],
            unsicher: a.unsicher_markiert,
          }
        }
        setAntwortenMap(map)

        if (fbRes.error) throw fbRes.error
        const fbMap: Record<string, FeedbackEintrag> = {}
        for (const f of fbRes.data ?? []) {
          fbMap[feedbackKey(f.ebene, f.bezug_id)] = { id: f.id, text: f.text }
        }
        setFeedback(fbMap)
      } catch (err) {
        setFehler(err instanceof Error ? err.message : 'Laden fehlgeschlagen.')
      } finally {
        setLaden(false)
      }
    })()
  }, [pruefungId, teilnehmerId])

  const auswertung: GesamtAuswertung | null = useMemo(() => {
    if (fragen.length === 0) return null
    return werteAus(fragen, antwortenMap, schwelleGesamt, schwelleProThema)
  }, [fragen, antwortenMap, schwelleGesamt, schwelleProThema])

  function feedbackText(ebene: string, bezugId: string | null): string {
    return feedback[feedbackKey(ebene, bezugId)]?.text ?? ''
  }

  function setFeedbackText(ebene: string, bezugId: string | null, text: string) {
    setFeedback((alt) => ({
      ...alt,
      [feedbackKey(ebene, bezugId)]: { ...alt[feedbackKey(ebene, bezugId)], text },
    }))
  }

  async function speichereFeedback(ebene: string, bezugId: string | null) {
    if (!teilnehmerId) return
    const key = feedbackKey(ebene, bezugId)
    const eintrag = feedback[key] ?? { text: '' }
    const text = eintrag.text.trim()
    try {
      if (!text) {
        if (eintrag.id) {
          await supabase.from('feedback').delete().eq('id', eintrag.id)
          setFeedback((alt) => ({ ...alt, [key]: { text: '' } }))
        }
        return
      }
      if (eintrag.id) {
        const { error } = await supabase.from('feedback').update({ text }).eq('id', eintrag.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('feedback')
          .insert({ teilnehmer_id: teilnehmerId, ebene, bezug_id: bezugId, text })
          .select('id')
          .single()
        if (error) throw error
        setFeedback((alt) => ({ ...alt, [key]: { id: data.id, text } }))
      }
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Feedback speichern fehlgeschlagen.')
    }
  }

  if (laden) return <p className="text-ifm-gray">Lädt …</p>
  if (fehler && !teilnehmer)
    return (
      <div>
        <ErrorBanner message={fehler} />
        <Link
          to={`/pruefungen/${pruefungId}`}
          className="mt-4 inline-block text-ifm-blue hover:underline"
        >
          ← Zurück
        </Link>
      </div>
    )

  return (
    <div className="max-w-4xl">
      <Link to={`/pruefungen/${pruefungId}`} className="text-sm text-ifm-gray hover:underline">
        ← Prüfung
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ifm-blue">{teilnehmer?.name}</h1>
          <p className="mt-1 text-ifm-gray">
            {vorlageName}
            {kursName && ` · ${kursName}`}
          </p>
        </div>
        {teilnehmer?.abgegeben_am == null ? (
          <span className="rounded-full bg-ifm-yellow/25 px-3 py-1 text-xs font-medium text-ifm-blue">
            noch nicht abgegeben
          </span>
        ) : auswertung ? (
          <span
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              auswertung.bestanden
                ? 'bg-ifm-green/15 text-ifm-green'
                : 'bg-ifm-red/10 text-ifm-red'
            }`}
          >
            {auswertung.bestanden ? 'Bestanden' : 'Nicht bestanden'}
          </span>
        ) : null}
      </div>

      {fehler && (
        <div className="mt-4">
          <ErrorBanner message={fehler} />
        </div>
      )}

      {auswertung && (
        <>
          {/* Themengebiet-Übersicht */}
          <Card className="mt-5 p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ifm-lightblue/60 text-ifm-blue">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Themengebiet</th>
                  <th className="px-4 py-2 text-right font-medium">Punkte</th>
                  <th className="px-4 py-2 text-right font-medium">Max</th>
                  <th className="px-4 py-2 text-right font-medium">Prozent</th>
                  <th className="px-4 py-2 text-center font-medium">Bestanden</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ifm-lightblue">
                {auswertung.proThemengebiet.map((t) => (
                  <tr key={t.id ?? 'none'}>
                    <td className="px-4 py-2 text-ifm-blue">{t.name}</td>
                    <td className="px-4 py-2 text-right text-ifm-blue">{t.punkte}</td>
                    <td className="px-4 py-2 text-right text-ifm-gray">{t.max}</td>
                    <td className="px-4 py-2 text-right text-ifm-blue">{t.prozent} %</td>
                    <td className="px-4 py-2 text-center">
                      {schwelleProThema == null ? (
                        <span className="text-ifm-gray">–</span>
                      ) : t.bestanden ? (
                        <span className="text-ifm-green font-bold">✓</span>
                      ) : (
                        <span className="text-ifm-red font-bold">✗</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-ifm-lightblue/30 font-semibold text-ifm-blue">
                <tr>
                  <td className="px-4 py-2">Gesamt</td>
                  <td className="px-4 py-2 text-right">{auswertung.punkteGesamt}</td>
                  <td className="px-4 py-2 text-right">{auswertung.punkteMax}</td>
                  <td className="px-4 py-2 text-right">{auswertung.prozentGesamt} %</td>
                  <td className="px-4 py-2 text-center">
                    {auswertung.bestanden ? (
                      <span className="text-ifm-green font-bold">✓</span>
                    ) : (
                      <span className="text-ifm-red font-bold">✗</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>

          <p className="mt-2 text-xs text-ifm-gray">
            Schwellen: {schwelleGesamt} % gesamt
            {schwelleProThema != null && ` · ${schwelleProThema} % je Themengebiet`}
          </p>

          {/* Gesamtfeedback */}
          <Card className="mt-5">
            <Textarea
              label="Gesamtfeedback (optional)"
              rows={3}
              value={feedbackText('gesamt', null)}
              onChange={(e) => setFeedbackText('gesamt', null, e.target.value)}
              onBlur={() => speichereFeedback('gesamt', null)}
              placeholder="Feedback an den Teilnehmer …"
            />
          </Card>

          {/* Fragen-Detail */}
          <h2 className="mt-8 mb-3 text-lg font-semibold text-ifm-blue">Fragen</h2>
          <div className="space-y-4">
            {auswertung.proFrage.map((fa, i) => (
              <Card key={fa.frage.pruefung_frage_id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs text-ifm-gray">
                      <span className="rounded-full bg-ifm-lightblue px-2 py-0.5 text-ifm-blue">
                        {fa.frage.themengebiet_name}
                      </span>
                      <span>{fa.frage.typ === 'multi' ? 'Multi' : 'Single'}</span>
                      {fa.unsicher && <span className="text-ifm-red">unsicher markiert</span>}
                    </div>
                    <p className="mt-2 text-ifm-blue font-medium">
                      {i + 1}. {fa.frage.text}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2 py-1 text-sm font-semibold ${
                      fa.punkte === fa.max
                        ? 'bg-ifm-green/15 text-ifm-green'
                        : fa.punkte === 0
                          ? 'bg-ifm-red/10 text-ifm-red'
                          : 'bg-ifm-yellow/25 text-ifm-blue'
                    }`}
                  >
                    {fa.punkte} / {fa.max}
                  </span>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {fa.frage.optionen.map((opt) => {
                    const gewaehlt = fa.gewaehlt.includes(opt.id)
                    const falschGewaehlt = gewaehlt && !opt.ist_richtig
                    return (
                      <li
                        key={opt.id}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                          opt.ist_richtig
                            ? 'bg-ifm-green/10'
                            : falschGewaehlt
                              ? 'bg-ifm-red/10'
                              : 'bg-ifm-lightblue/30'
                        }`}
                      >
                        <span
                          className={`w-4 shrink-0 text-center font-bold ${
                            opt.ist_richtig
                              ? 'text-ifm-green'
                              : falschGewaehlt
                                ? 'text-ifm-red'
                                : 'text-transparent'
                          }`}
                        >
                          {opt.ist_richtig ? '✓' : falschGewaehlt ? '✗' : '·'}
                        </span>
                        <span
                          className={
                            opt.ist_richtig
                              ? 'text-ifm-green'
                              : falschGewaehlt
                                ? 'text-ifm-red'
                                : 'text-ifm-blue'
                          }
                        >
                          {opt.text}
                        </span>
                        {gewaehlt && (
                          <span className="ml-auto shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-xs text-ifm-gray">
                            gewählt
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-3">
                  <Textarea
                    label="Feedback zu dieser Frage (optional)"
                    rows={2}
                    value={feedbackText('frage', fa.frage.frage_id)}
                    onChange={(e) => setFeedbackText('frage', fa.frage.frage_id, e.target.value)}
                    onBlur={() => speichereFeedback('frage', fa.frage.frage_id)}
                  />
                </div>
              </Card>
            ))}
          </div>

          {/* Themengebiet-Feedback */}
          <h2 className="mt-8 mb-3 text-lg font-semibold text-ifm-blue">
            Feedback je Themengebiet
          </h2>
          <div className="space-y-3">
            {auswertung.proThemengebiet
              .filter((t) => t.id != null)
              .map((t) => (
                <Card key={t.id}>
                  <Textarea
                    label={t.name}
                    rows={2}
                    value={feedbackText('themengebiet', t.id)}
                    onChange={(e) => setFeedbackText('themengebiet', t.id, e.target.value)}
                    onBlur={() => speichereFeedback('themengebiet', t.id)}
                  />
                </Card>
              ))}
          </div>
        </>
      )}
    </div>
  )
}

function feedbackKey(ebene: string, bezugId: string | null): string {
  return `${ebene}:${bezugId ?? ''}`
}
