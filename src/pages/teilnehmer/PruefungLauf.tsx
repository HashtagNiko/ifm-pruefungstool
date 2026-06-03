import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  abgeben,
  antwortSpeichern,
  fragenLaden,
  statusLaden,
  type ErgebnisInfo,
  type TeilnehmerFrage,
} from '../../lib/teilnehmerApi'
import { seededShuffle } from '../../lib/seededShuffle'
import { Button, ConfirmDialog, ErrorBanner } from '../../components/ui'
import { ThumbsDownIcon } from '../../components/icons'

interface AntwortState {
  optionen: string[]
  unsicher: boolean
}

export default function PruefungLauf({
  teilnehmerId,
  code,
  onAbgegeben,
}: {
  teilnehmerId: string
  code: string
  onAbgegeben: (ergebnis: ErgebnisInfo) => void
}) {
  const [fragen, setFragen] = useState<TeilnehmerFrage[]>([])
  const [antworten, setAntworten] = useState<Record<string, AntwortState>>({})
  const [ausschluss, setAusschluss] = useState<Record<string, string[]>>({})
  const [aktuell, setAktuell] = useState(0)
  const [endZeit, setEndZeit] = useState<string | null>(null)
  const [restSek, setRestSek] = useState<number | null>(null)
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [abgabeOffen, setAbgabeOffen] = useState(false)
  const [abgebend, setAbgebend] = useState(false)

  const ausschlussKey = `ausschluss-${teilnehmerId}`
  const saveChain = useRef<Promise<void>>(Promise.resolve())
  const abgegebenRef = useRef(false)

  // Initial laden
  useEffect(() => {
    ;(async () => {
      try {
        const info = await fragenLaden(teilnehmerId)
        if (info.abgegeben) {
          // bereits abgegeben -> direkt Ergebnis
          onAbgegeben(await abgeben(teilnehmerId))
          return
        }
        setFragen(info.fragen)
        setEndZeit(info.end_zeit)
        const map: Record<string, AntwortState> = {}
        for (const a of info.antworten) {
          map[a.pruefung_frage_id] = { optionen: a.optionen ?? [], unsicher: a.unsicher }
        }
        setAntworten(map)
        // Ausschluss aus localStorage
        try {
          const roh = localStorage.getItem(ausschlussKey)
          if (roh) setAusschluss(JSON.parse(roh))
        } catch {
          /* ignore */
        }
      } catch (err) {
        setFehler(err instanceof Error ? err.message : 'Laden fehlgeschlagen.')
      } finally {
        setLaden(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teilnehmerId])

  // Antwortreihenfolge zufällig, aber stabil pro Teilnehmer + Frage
  const optionenReihenfolge = useMemo(() => {
    const map: Record<string, TeilnehmerFrage['optionen']> = {}
    for (const f of fragen) {
      map[f.pruefung_frage_id] = seededShuffle(f.optionen, `${teilnehmerId}:${f.pruefung_frage_id}`)
    }
    return map
  }, [fragen, teilnehmerId])

  const abgebenJetzt = useCallback(async () => {
    if (abgegebenRef.current) return
    abgegebenRef.current = true
    setAbgebend(true)
    try {
      await saveChain.current
      const ergebnis = await abgeben(teilnehmerId)
      onAbgegeben(ergebnis)
    } catch (err) {
      abgegebenRef.current = false
      setFehler(err instanceof Error ? err.message : 'Abgabe fehlgeschlagen.')
      setAbgebend(false)
    }
  }, [teilnehmerId, onAbgegeben])

  // Timer
  useEffect(() => {
    if (!endZeit) return
    const ende = new Date(endZeit).getTime()
    const tick = () => {
      const rest = Math.max(0, Math.round((ende - Date.now()) / 1000))
      setRestSek(rest)
      if (rest <= 0) abgebenJetzt()
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [endZeit, abgebenJetzt])

  // Status-Polling: erkennt, wenn Trainer die Prüfung beendet
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const s = await statusLaden(code)
        if (s.status === 'beendet') abgebenJetzt()
      } catch {
        /* offline o.ä. -> ignorieren */
      }
    }, 8000)
    return () => clearInterval(iv)
  }, [code, abgebenJetzt])

  function planeSpeichern(pruefungFrageId: string, state: AntwortState) {
    saveChain.current = saveChain.current
      .catch(() => {})
      .then(() =>
        antwortSpeichern(teilnehmerId, pruefungFrageId, state.optionen, state.unsicher),
      )
      .catch((err) => {
        setFehler(
          err instanceof Error ? `Speichern fehlgeschlagen: ${err.message}` : 'Speichern fehlgeschlagen.',
        )
      })
  }

  function aktualisiere(pruefungFrageId: string, patch: Partial<AntwortState>) {
    setAntworten((alt) => {
      const vorher = alt[pruefungFrageId] ?? { optionen: [], unsicher: false }
      const neu = { ...vorher, ...patch }
      planeSpeichern(pruefungFrageId, neu)
      return { ...alt, [pruefungFrageId]: neu }
    })
  }

  function optionUmschalten(frage: TeilnehmerFrage, optionId: string) {
    const vorher = antworten[frage.pruefung_frage_id]?.optionen ?? []
    let neu: string[]
    if (frage.typ === 'single') {
      neu = [optionId]
    } else {
      neu = vorher.includes(optionId)
        ? vorher.filter((o) => o !== optionId)
        : [...vorher, optionId]
    }
    aktualisiere(frage.pruefung_frage_id, { optionen: neu })
  }

  function unsicherUmschalten(frage: TeilnehmerFrage) {
    const vorher = antworten[frage.pruefung_frage_id]?.unsicher ?? false
    aktualisiere(frage.pruefung_frage_id, { unsicher: !vorher })
  }

  function ausschlussUmschalten(pruefungFrageId: string, optionId: string) {
    setAusschluss((alt) => {
      const vorher = alt[pruefungFrageId] ?? []
      const neu = vorher.includes(optionId)
        ? vorher.filter((o) => o !== optionId)
        : [...vorher, optionId]
      const next = { ...alt, [pruefungFrageId]: neu }
      try {
        localStorage.setItem(ausschlussKey, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  if (laden) return <ZentrierterHinweis text="Prüfung wird geladen …" />
  if (fehler && fragen.length === 0)
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorBanner message={fehler} />
      </div>
    )

  const frage = fragen[aktuell]
  if (!frage) return <ZentrierterHinweis text="Keine Fragen vorhanden." />

  const istBeantwortet = (id: string) => (antworten[id]?.optionen.length ?? 0) > 0
  const istUnsicher = (id: string) => antworten[id]?.unsicher ?? false
  const beantwortetAnzahl = fragen.filter((f) => istBeantwortet(f.pruefung_frage_id)).length
  const unbeantwortet = fragen.length - beantwortetAnzahl
  const unsicherAnzahl = fragen.filter((f) => istUnsicher(f.pruefung_frage_id)).length

  const aktuelleAntwort = antworten[frage.pruefung_frage_id] ?? { optionen: [], unsicher: false }
  const aktuellerAusschluss = ausschluss[frage.pruefung_frage_id] ?? []

  return (
    <div className="min-h-full bg-ifm-lightblue/40 flex flex-col">
      {/* Kopf: Timer + Fortschritt + Kreis-Navigation */}
      <header className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-ifm-gray">
              Frage {aktuell + 1} von {fragen.length} · {beantwortetAnzahl} beantwortet
            </span>
            {restSek != null && (
              <span
                className={`text-sm font-semibold tabular-nums ${
                  restSek <= 300 ? 'text-ifm-red' : 'text-ifm-blue'
                }`}
              >
                {formatZeit(restSek)}
              </span>
            )}
          </div>
          {restSek != null && restSek <= 300 && (
            <div className="mb-2 text-xs text-ifm-red">Noch {Math.ceil(restSek / 60)} Minuten.</div>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {fragen.map((f, i) => {
              const beantwortet = istBeantwortet(f.pruefung_frage_id)
              const unsicher = istUnsicher(f.pruefung_frage_id)
              const aktivKlasse = i === aktuell ? 'ring-2 ring-offset-2 ring-ifm-blue' : ''
              let klasse = 'border-2 border-ifm-blue text-ifm-blue bg-white'
              let inhalt: string = String(i + 1)
              if (unsicher) {
                klasse = 'border-2 border-ifm-red text-ifm-red bg-white'
                inhalt = '?'
              } else if (beantwortet) {
                klasse = 'bg-ifm-green text-white border-2 border-ifm-green'
              }
              return (
                <button
                  key={f.pruefung_frage_id}
                  type="button"
                  onClick={() => setAktuell(i)}
                  aria-label={`Zu Frage ${i + 1}`}
                  className={`shrink-0 h-9 w-9 rounded-full text-sm font-semibold transition-shadow ${klasse} ${aktivKlasse}`}
                >
                  {inhalt}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Frage */}
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {frage.themengebiet && (
            <span className="inline-block rounded-full bg-ifm-lightblue px-3 py-1 text-xs text-ifm-blue">
              {frage.themengebiet}
            </span>
          )}
          <h1 className="mt-3 text-xl font-semibold text-ifm-blue">{frage.text}</h1>
          <p className="mt-1 text-sm text-ifm-gray">
            {frage.typ === 'multi'
              ? 'Mehrfachauswahl (2 Antworten richtig, max. 2 Punkte)'
              : 'Einfachauswahl (1 Antwort richtig, max. 1 Punkt)'}
          </p>

          {/* Antworten: Ausschluss | Text | Auswahl */}
          <div className="mt-5 rounded-2xl bg-white shadow-sm overflow-hidden">
            <div className="grid grid-cols-[64px_1fr_64px] items-center bg-ifm-lightblue/50 px-3 py-2 text-xs font-medium text-ifm-gray">
              <span className="text-center">Ausschluss</span>
              <span />
              <span className="text-center">Auswahl</span>
            </div>
            <ul className="divide-y divide-ifm-lightblue">
              {optionenReihenfolge[frage.pruefung_frage_id]?.map((opt) => {
                const gewaehlt = aktuelleAntwort.optionen.includes(opt.id)
                const ausgeschlossen = aktuellerAusschluss.includes(opt.id)
                return (
                  <li
                    key={opt.id}
                    className="grid grid-cols-[64px_1fr_64px] items-center px-3 py-3"
                  >
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => ausschlussUmschalten(frage.pruefung_frage_id, opt.id)}
                        aria-label={ausgeschlossen ? 'Ausschluss aufheben' : 'Als ausgeschlossen markieren'}
                        aria-pressed={ausgeschlossen}
                        title="Denkhilfe: Antwort ausschließen (zählt nicht zur Wertung)"
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                          ausgeschlossen
                            ? 'bg-ifm-red/10 text-ifm-red'
                            : 'text-ifm-gray hover:bg-ifm-lightblue/60'
                        }`}
                      >
                        <ThumbsDownIcon />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => optionUmschalten(frage, opt.id)}
                      className={`text-left px-2 ${
                        ausgeschlossen ? 'text-ifm-gray line-through' : 'text-ifm-blue'
                      }`}
                    >
                      {opt.text}
                    </button>

                    <div className="flex justify-center">
                      <button
                        type="button"
                        role={frage.typ === 'single' ? 'radio' : 'checkbox'}
                        aria-checked={gewaehlt}
                        onClick={() => optionUmschalten(frage, opt.id)}
                        aria-label="Auswählen"
                        className={`inline-flex h-6 w-6 items-center justify-center border-2 transition-colors ${
                          frage.typ === 'single' ? 'rounded-full' : 'rounded-md'
                        } ${
                          gewaehlt
                            ? 'border-ifm-blue bg-ifm-blue text-white'
                            : 'border-ifm-gray/50 bg-white'
                        }`}
                      >
                        {gewaehlt && (
                          <span className={frage.typ === 'single' ? 'h-2.5 w-2.5 rounded-full bg-white' : 'text-sm'}>
                            {frage.typ === 'single' ? '' : '✓'}
                          </span>
                        )}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Unsicher-Button (rot) */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => unsicherUmschalten(frage)}
              aria-pressed={aktuelleAntwort.unsicher}
              className={`rounded-lg px-4 py-2 text-sm font-medium border-2 transition-colors ${
                aktuelleAntwort.unsicher
                  ? 'bg-ifm-red text-white border-ifm-red'
                  : 'text-ifm-red border-ifm-red hover:bg-ifm-red/10'
              }`}
            >
              {aktuelleAntwort.unsicher ? '★ Als unsicher markiert' : 'Als unsicher markieren'}
            </button>
          </div>

          {fehler && (
            <div className="mt-4">
              <ErrorBanner message={fehler} />
            </div>
          )}
        </div>
      </main>

      {/* Navigation unten */}
      <footer className="sticky bottom-0 bg-white shadow-[0_-1px_4px_rgba(0,0,0,0.06)]">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            disabled={aktuell === 0}
            onClick={() => setAktuell((i) => Math.max(0, i - 1))}
          >
            Vorherige
          </Button>
          {aktuell < fragen.length - 1 ? (
            <Button onClick={() => setAktuell((i) => Math.min(fragen.length - 1, i + 1))}>
              Nächste
            </Button>
          ) : (
            <Button onClick={() => setAbgabeOffen(true)} disabled={abgebend}>
              Abgeben
            </Button>
          )}
        </div>
      </footer>

      <ConfirmDialog
        open={abgabeOffen}
        title="Prüfung abgeben?"
        message={
          <>
            Möchtest du die Prüfung wirklich abgeben?
            {(unbeantwortet > 0 || unsicherAnzahl > 0) && (
              <span className="mt-2 block text-ifm-red">
                {unbeantwortet > 0 && <>Noch {unbeantwortet} unbeantwortet. </>}
                {unsicherAnzahl > 0 && <>{unsicherAnzahl} als unsicher markiert.</>}
              </span>
            )}
          </>
        }
        confirmLabel="Jetzt abgeben"
        variant="primary"
        busy={abgebend}
        onConfirm={() => {
          setAbgabeOffen(false)
          abgebenJetzt()
        }}
        onClose={() => setAbgabeOffen(false)}
      />
    </div>
  )
}

function ZentrierterHinweis({ text }: { text: string }) {
  return (
    <div className="min-h-full flex items-center justify-center text-ifm-gray">{text}</div>
  )
}

function formatZeit(sek: number): string {
  const m = Math.floor(sek / 60)
  const s = sek % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
