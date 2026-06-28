import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button, Card, EmptyState, ErrorBanner } from '../components/ui'
import { tauscheFrage } from '../lib/pruefungErstellen'
import { seededShuffle } from '../lib/seededShuffle'

interface Opt {
  id: string
  text: string
  ist_richtig: boolean
  sortierung: number
}
interface VFrage {
  pruefung_frage_id: string
  frage_id: string
  themengebiet_id: string | null
  text: string
  typ: 'single' | 'multi'
  themengebiet: string | null
  optionen: Opt[]
}

/**
 * Trainer-Vorschau: Prüfung einmal durchklicken wie ein Teilnehmer, mit der Möglichkeit,
 * pro Frage die richtige Lösung einzublenden. Rein lokal – nichts wird gespeichert.
 */
export default function VorschauPage() {
  const { id } = useParams<{ id: string }>()
  const [titel, setTitel] = useState('Vorschau')
  const [kursId, setKursId] = useState('')
  const [editierbar, setEditierbar] = useState(false)
  // null = eigene Prüfung (alles); Set = eingeschränkt geteilt (nur diese Themengebiete tauschbar)
  const [bearbeitbareTg, setBearbeitbareTg] = useState<Set<string> | null>(null)
  const [fragen, setFragen] = useState<VFrage[]>([])
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)

  const [aktuell, setAktuell] = useState(0)
  const [auswahl, setAuswahl] = useState<Record<string, string[]>>({})
  const [geloest, setGeloest] = useState<Set<string>>(new Set())
  const [tauschBusy, setTauschBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLaden(true)
      try {
        const { data: pr } = await supabase
          .from('pruefung')
          .select('status, uebungsmodus, quelle_freigabe_id, pruefungsvorlage(name, kurs_id)')
          .eq('id', id)
          .single()
          .returns<{
            status: string
            uebungsmodus: boolean
            quelle_freigabe_id: string | null
            pruefungsvorlage: { name: string; kurs_id: string } | null
          }>()
        if (pr?.pruefungsvorlage?.name) setTitel(pr.pruefungsvorlage.name)
        if (pr?.pruefungsvorlage?.kurs_id) setKursId(pr.pruefungsvorlage.kurs_id)
        setEditierbar(pr?.status === 'entwurf' || pr?.uebungsmodus === true)
        if (pr?.quelle_freigabe_id) {
          const { data: fr } = await supabase
            .from('pruefung_freigabe')
            .select('bearbeitbare_themengebiete')
            .eq('id', pr.quelle_freigabe_id)
            .maybeSingle()
          setBearbeitbareTg(new Set(fr?.bearbeitbare_themengebiete ?? []))
        }

        const { data: snap, error: snapErr } = await supabase
          .from('pruefung_frage')
          .select('id, sortierung, frage_id, themengebiet_id, frage(text, typ), themengebiet(name)')
          .eq('pruefung_id', id)
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
          >()
        if (snapErr) throw snapErr

        const frageIds = (snap ?? []).map((s) => s.frage_id)
        const { data: opts, error: optErr } = await supabase
          .from('antwortoption')
          .select('id, frage_id, text, ist_richtig, sortierung')
          .in('frage_id', frageIds)
        if (optErr) throw optErr

        const proFrage = new Map<string, Opt[]>()
        for (const o of opts ?? []) {
          const liste = proFrage.get(o.frage_id) ?? []
          liste.push(o)
          proFrage.set(o.frage_id, liste)
        }

        setFragen(
          (snap ?? []).map((s) => ({
            pruefung_frage_id: s.id,
            frage_id: s.frage_id,
            themengebiet_id: s.themengebiet_id,
            text: s.frage?.text ?? '',
            typ: (s.frage?.typ as 'single' | 'multi') ?? 'single',
            themengebiet: s.themengebiet?.name ?? null,
            // Antwortreihenfolge zufällig (stabil pro Frage), nicht „richtig zuerst"
            optionen: seededShuffle(proFrage.get(s.frage_id) ?? [], s.id),
          })),
        )
      } catch (err) {
        setFehler(err instanceof Error ? err.message : 'Laden fehlgeschlagen.')
      } finally {
        setLaden(false)
      }
    })()
  }, [id])

  function optionUmschalten(frage: VFrage, optionId: string) {
    setAuswahl((alt) => {
      const vorher = alt[frage.pruefung_frage_id] ?? []
      let neu: string[]
      if (frage.typ === 'single') neu = [optionId]
      else neu = vorher.includes(optionId) ? vorher.filter((o) => o !== optionId) : [...vorher, optionId]
      return { ...alt, [frage.pruefung_frage_id]: neu }
    })
  }

  function loesungUmschalten(pfId: string) {
    setGeloest((alt) => {
      const neu = new Set(alt)
      if (neu.has(pfId)) neu.delete(pfId)
      else neu.add(pfId)
      return neu
    })
  }

  async function frageNeuWuerfeln(index: number) {
    const f = fragen[index]
    if (!f.themengebiet_id || !kursId) return
    setTauschBusy(f.pruefung_frage_id)
    setFehler(null)
    try {
      const neueFrageId = await tauscheFrage(
        f.pruefung_frage_id,
        kursId,
        f.themengebiet_id,
        fragen.map((x) => x.frage_id),
      )
      const [{ data: nf }, { data: nopts }] = await Promise.all([
        supabase.from('frage').select('text, typ').eq('id', neueFrageId).single(),
        supabase
          .from('antwortoption')
          .select('id, text, ist_richtig, sortierung')
          .eq('frage_id', neueFrageId),
      ])
      setFragen((alt) =>
        alt.map((x, i) =>
          i === index
            ? {
                ...x,
                frage_id: neueFrageId,
                text: nf?.text ?? '',
                typ: (nf?.typ as 'single' | 'multi') ?? 'single',
                optionen: seededShuffle(nopts ?? [], f.pruefung_frage_id),
              }
            : x,
        ),
      )
      // Auswahl/Lösung dieser Frage zurücksetzen
      setAuswahl((a) => ({ ...a, [f.pruefung_frage_id]: [] }))
      setGeloest((g) => {
        const n = new Set(g)
        n.delete(f.pruefung_frage_id)
        return n
      })
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Tauschen fehlgeschlagen.')
    } finally {
      setTauschBusy(null)
    }
  }

  if (laden) return <p className="text-ifm-gray">Lädt …</p>
  if (fehler)
    return (
      <div>
        <ErrorBanner message={fehler} />
        <Link to={`/pruefungen/${id}`} className="mt-4 inline-block text-ifm-blue hover:underline">
          ← Zurück
        </Link>
      </div>
    )

  const frage = fragen[aktuell]
  function darfTauschen(themengebietId: string | null): boolean {
    if (!editierbar || !themengebietId) return false
    if (bearbeitbareTg === null) return true
    return bearbeitbareTg.has(themengebietId)
  }

  return (
    <div className="max-w-3xl">
      <Link to={`/pruefungen/${id}`} className="text-sm text-ifm-gray hover:underline">
        ← Prüfung
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <h1 className="text-2xl font-bold text-ifm-blue">{titel}</h1>
        <span className="rounded-full bg-ifm-lightblue px-3 py-1 text-xs font-medium text-ifm-blue">
          Vorschau
        </span>
      </div>
      <p className="mt-1 text-ifm-gray">
        Test-Durchlauf zum Prüfen der Fragen und Antworten – nichts wird gespeichert.
      </p>

      {fragen.length === 0 ? (
        <div className="mt-6">
          <EmptyState>Kein Fragen-Snapshot vorhanden.</EmptyState>
        </div>
      ) : (
        <>
          {/* Kreis-Navigation */}
          <div className="mt-5 flex gap-2 overflow-x-auto px-1 py-2">
            {fragen.map((f, i) => {
              const beantwortet = (auswahl[f.pruefung_frage_id]?.length ?? 0) > 0
              const klasse = beantwortet
                ? 'bg-ifm-green text-white border-2 border-ifm-green'
                : 'border-2 border-ifm-blue text-ifm-blue bg-white'
              return (
                <button
                  key={f.pruefung_frage_id}
                  type="button"
                  onClick={() => setAktuell(i)}
                  className={`shrink-0 h-9 w-9 rounded-full text-sm font-semibold ${klasse} ${
                    i === aktuell ? 'ring-2 ring-offset-2 ring-ifm-blue' : ''
                  }`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>

          <Card className="mt-3">
            <div className="text-sm text-ifm-gray">
              Frage {aktuell + 1} von {fragen.length}
              {frage.themengebiet && (
                <span className="ml-2 rounded-full bg-ifm-lightblue px-2 py-0.5 text-ifm-blue">
                  {frage.themengebiet}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-lg font-semibold text-ifm-blue">{frage.text}</h2>
            <p className="mt-1 text-xs text-ifm-gray">
              {frage.typ === 'multi' ? 'Mehrfachauswahl (2 richtig)' : 'Einfachauswahl (1 richtig)'}
            </p>

            <ul className="mt-4 space-y-2">
              {frage.optionen.map((opt) => {
                const gewaehlt = (auswahl[frage.pruefung_frage_id] ?? []).includes(opt.id)
                const zeigeLoesung = geloest.has(frage.pruefung_frage_id)
                const falschGewaehlt = zeigeLoesung && gewaehlt && !opt.ist_richtig
                let rahmen = 'border-ifm-gray/30'
                if (zeigeLoesung && opt.ist_richtig) rahmen = 'border-ifm-green bg-ifm-green/10'
                else if (falschGewaehlt) rahmen = 'border-ifm-red bg-ifm-red/10'
                else if (gewaehlt) rahmen = 'border-ifm-blue bg-ifm-lightblue/40'
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => optionUmschalten(frage, opt.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${rahmen}`}
                    >
                      <span
                        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center border-2 ${
                          frage.typ === 'single' ? 'rounded-full' : 'rounded-md'
                        } ${gewaehlt ? 'border-ifm-blue bg-ifm-blue text-white' : 'border-ifm-gray/50 bg-white'}`}
                      >
                        {gewaehlt && (frage.typ === 'multi' ? '✓' : <span className="h-2 w-2 rounded-full bg-white" />)}
                      </span>
                      <span className="flex-1 text-ifm-blue">{opt.text}</span>
                      {zeigeLoesung && opt.ist_richtig && (
                        <span className="text-xs font-medium text-ifm-green">richtig</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => loesungUmschalten(frage.pruefung_frage_id)}>
                {geloest.has(frage.pruefung_frage_id) ? 'Lösung ausblenden' : 'Lösung anzeigen'}
              </Button>
              {darfTauschen(frage.themengebiet_id) && (
                <Button
                  variant="secondary"
                  onClick={() => frageNeuWuerfeln(aktuell)}
                  disabled={tauschBusy === frage.pruefung_frage_id}
                >
                  {tauschBusy === frage.pruefung_frage_id ? 'Würfle …' : 'Frage neu würfeln'}
                </Button>
              )}
            </div>
          </Card>

          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="secondary"
              disabled={aktuell === 0}
              onClick={() => setAktuell((i) => Math.max(0, i - 1))}
            >
              Vorherige
            </Button>
            <Button
              disabled={aktuell === fragen.length - 1}
              onClick={() => setAktuell((i) => Math.min(fragen.length - 1, i + 1))}
            >
              Nächste
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
