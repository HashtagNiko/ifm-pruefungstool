import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import type { Tables } from '../lib/database.types'
import { ConfirmDialog, EmptyState, ErrorBanner, IconButton } from '../components/ui'
import { PencilIcon, PlusIcon, TrashIcon } from '../components/icons'
import FrageModal, { type FrageMitOptionen } from '../components/FrageModal'
import FragenImportModal from '../components/FragenImportModal'

type Kurs = Tables<'kurs'>
type Themengebiet = Tables<'themengebiet'>
type FrageRow = FrageMitOptionen & { themengebiet: { name: string } | null }

const OHNE_TG = '∅'

export default function FragenpoolPage() {
  const { user } = useAuth()
  const [kurse, setKurse] = useState<Kurs[]>([])
  const [kursId, setKursId] = useState<string>('')
  const [themen, setThemen] = useState<Themengebiet[]>([])
  const [fragen, setFragen] = useState<FrageRow[]>([])
  // Empfänger einer geteilten Prüfung: in diesen Themengebieten darf er bearbeiten
  const [freigegebeneTg, setFreigegebeneTg] = useState<Set<string>>(new Set())
  // Vom aktuellen Trainer ausgeblendete Fragen (eigene "Löschungen" an geteilten Kursen)
  const [ausgeblendet, setAusgeblendet] = useState<Set<string>>(new Set())
  const [offen, setOffen] = useState<Set<string>>(new Set())
  const [offeneFragen, setOffeneFragen] = useState<Set<string>>(new Set())
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweis, setHinweis] = useState<string | null>(null)

  const [bearbeite, setBearbeite] = useState<FrageMitOptionen | null | undefined>(undefined)
  const [neueFrageTg, setNeueFrageTg] = useState<string | undefined>(undefined)
  const [importOffen, setImportOffen] = useState(false)
  const [loeschKandidat, setLoeschKandidat] = useState<FrageRow | null>(null)
  const [loeschBusy, setLoeschBusy] = useState(false)

  const aktuellerKurs = kurse.find((k) => k.id === kursId)
  const istBesitzer = !!aktuellerKurs && aktuellerKurs.owner_id === user?.id

  // Kurse einmalig laden
  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase
        .from('kurs')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) setFehler(error.message)
      else {
        setKurse(data)
        if (data.length > 0) setKursId(data[0].id)
      }
      setLaden(false)
    })()
  }, [])

  const ladeKursinhalt = useCallback(async () => {
    if (!kursId) return
    setFehler(null)
    const kurs = kurse.find((k) => k.id === kursId)
    const besitzer = !!kurs && kurs.owner_id === user?.id

    const [{ data: t, error: tErr }, { data: f, error: fErr }] = await Promise.all([
      supabase
        .from('themengebiet')
        .select('*')
        .eq('kurs_id', kursId)
        .order('sortierung', { ascending: true }),
      supabase
        .from('frage')
        .select('*, antwortoption(*), themengebiet(name)')
        .eq('kurs_id', kursId)
        .order('erstellt_am', { ascending: true })
        .returns<FrageRow[]>(),
    ])
    if (tErr) setFehler(tErr.message)
    else if (t) setThemen(t)
    if (fErr) setFehler(fErr.message)
    else if (f) setFragen(f)

    if (!besitzer && user) {
      // Geteilter Kurs: freigegebene Themengebiete + eigene Ausblendungen laden
      const themenIds = new Set((t ?? []).map((x) => x.id))
      const { data: frgs } = await supabase
        .from('pruefung_freigabe')
        .select('bearbeitbare_themengebiete')
        .eq('empfaenger_id', user.id)
        .eq('status', 'angenommen')
        .in('modus', ['eingeschraenkt', 'korrektur'])
      const freig = new Set<string>()
      for (const fr of frgs ?? [])
        for (const tg of fr.bearbeitbare_themengebiete ?? []) if (themenIds.has(tg)) freig.add(tg)
      setFreigegebeneTg(freig)

      const { data: aus } = await supabase
        .from('frage_ausgeblendet')
        .select('frage_id')
        .eq('trainer_id', user.id)
      setAusgeblendet(new Set((aus ?? []).map((x) => x.frage_id)))
    } else {
      setFreigegebeneTg(new Set())
      setAusgeblendet(new Set())
    }
  }, [kursId, kurse, user])

  useEffect(() => {
    setOffen(new Set())
    ladeKursinhalt()
  }, [ladeKursinhalt])

  function toggle(id: string) {
    setOffen((alt) => {
      const neu = new Set(alt)
      if (neu.has(id)) neu.delete(id)
      else neu.add(id)
      return neu
    })
  }

  function frageAufklappen(id: string) {
    setOffeneFragen((alt) => {
      const neu = new Set(alt)
      if (neu.has(id)) neu.delete(id)
      else neu.add(id)
      return neu
    })
  }

  function darfBearbeiten(themengebietId: string | null): boolean {
    if (istBesitzer) return true
    return themengebietId != null && freigegebeneTg.has(themengebietId)
  }

  async function loeschenBestaetigt() {
    if (!loeschKandidat || !user) return
    setLoeschBusy(true)
    if (istBesitzer) {
      // Echtes Löschen (Antwortoptionen per FK cascade)
      const { error } = await supabase.from('frage').delete().eq('id', loeschKandidat.id)
      if (error) setFehler(error.message)
      else {
        setFragen((alt) => alt.filter((x) => x.id !== loeschKandidat.id))
        setLoeschKandidat(null)
      }
    } else {
      // Geteilter Kurs: nur für mich ausblenden – beim Besitzer bleibt die Frage erhalten
      const { error } = await supabase
        .from('frage_ausgeblendet')
        .insert({ trainer_id: user.id, frage_id: loeschKandidat.id })
      if (error) setFehler(error.message)
      else {
        setAusgeblendet((alt) => new Set(alt).add(loeschKandidat.id))
        setLoeschKandidat(null)
      }
    }
    setLoeschBusy(false)
  }

  // Sichtbare Fragen (ausgeblendete raus) gruppiert nach Themengebiet
  const sichtbar = fragen.filter((f) => !ausgeblendet.has(f.id))
  const sektionen: { key: string; tgId: string | null; name: string; fragen: FrageRow[] }[] =
    themen.map((t) => ({
      key: t.id,
      tgId: t.id,
      name: t.name,
      fragen: sichtbar.filter((f) => f.themengebiet_id === t.id),
    }))
  const ohne = sichtbar.filter((f) => !f.themengebiet_id)
  if (ohne.length > 0)
    sektionen.push({ key: OHNE_TG, tgId: null, name: 'Ohne Themengebiet', fragen: ohne })

  function frageAnlegen(tgId?: string) {
    setNeueFrageTg(tgId)
    setBearbeite(null)
  }

  if (laden) return <p className="text-ifm-gray">Lädt …</p>

  if (kurse.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ifm-blue">Fragenpool</h1>
        <div className="mt-6">
          <EmptyState>
            Du hast noch keinen Kurs. Lege zuerst unter{' '}
            <Link to="/kurse" className="text-ifm-blue font-medium hover:underline">
              Kurse
            </Link>{' '}
            einen Kurs an.
          </EmptyState>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ifm-blue">Fragenpool</h1>
          <p className="mt-1 text-ifm-gray">Fragen je Kurs verwalten und importieren.</p>
        </div>
        {istBesitzer && (
          <div className="flex items-center gap-2">
            <span data-tour="fp-neue-frage">
              <IconButton
                variant="primary"
                label="Neue Frage"
                onClick={() => frageAnlegen(undefined)}
                disabled={themen.length === 0}
              >
                <PlusIcon />
              </IconButton>
            </span>
            <button
              type="button"
              data-tour="fp-import"
              onClick={() => setImportOffen(true)}
              className="rounded-lg border border-ifm-gray/40 bg-white px-4 py-2 text-sm font-medium text-ifm-blue hover:bg-ifm-lightblue/50"
            >
              Importieren
            </button>
          </div>
        )}
      </div>

      {/* Kurs-Auswahl (modern) */}
      <div className="mb-5" data-tour="fp-kurs">
        <span className="block text-xs font-medium text-ifm-gray mb-1.5">Kurs</span>
        <div className="flex flex-wrap gap-2">
          {kurse.map((k) => {
            const aktiv = k.id === kursId
            const fremd = k.owner_id !== user?.id
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setKursId(k.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  aktiv
                    ? 'bg-ifm-blue text-white'
                    : 'bg-white text-ifm-blue border border-ifm-gray/30 hover:bg-ifm-lightblue/50'
                }`}
              >
                {k.name}
                {fremd && (
                  <span
                    className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${
                      aktiv ? 'bg-white/20' : 'bg-ifm-lightblue text-ifm-blue'
                    }`}
                  >
                    geteilt
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {!istBesitzer && aktuellerKurs && (
        <div className="mb-4 rounded-lg bg-ifm-lightblue/60 text-ifm-blue text-sm p-3">
          Geteilter Kurs: Du kannst nur in deinen freigegebenen Themengebieten Fragen hinzufügen
          oder ausblenden. Ausblenden entfernt die Frage nur bei dir – beim Besitzer bleibt sie
          erhalten. Hinzugefügte Fragen werden im Pool des Besitzers gespeichert.
        </div>
      )}

      {hinweis && (
        <div className="mb-4 rounded-lg bg-ifm-green/10 text-ifm-green text-sm p-3">{hinweis}</div>
      )}
      {fehler && (
        <div className="mb-4">
          <ErrorBanner message={fehler} />
        </div>
      )}

      {istBesitzer && themen.length === 0 && (
        <div className="mb-4 rounded-lg bg-ifm-yellow/20 text-ifm-blue text-sm p-3">
          Dieser Kurs hat noch keine Themengebiete. Lege sie im{' '}
          <Link to={`/kurse/${kursId}`} className="font-medium hover:underline">
            Kurs
          </Link>{' '}
          an oder importiere Fragen (Themengebiete werden dann automatisch erstellt).
        </div>
      )}

      {sektionen.length === 0 ? (
        <EmptyState>Keine Fragen vorhanden.</EmptyState>
      ) : (
        <div className="space-y-3">
          {sektionen.map((s) => {
            const auf = offen.has(s.key)
            const editierbar = darfBearbeiten(s.tgId)
            return (
              <div
                key={s.key}
                className="rounded-xl border border-ifm-gray/20 bg-white overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggle(s.key)}
                    className="flex flex-1 items-center gap-2 text-left"
                    aria-expanded={auf}
                  >
                    <span className="select-none text-ifm-gray">{auf ? '▾' : '▸'}</span>
                    <span className="font-semibold text-ifm-blue">{s.name}</span>
                    <span className="rounded-full bg-ifm-lightblue px-2 py-0.5 text-xs text-ifm-blue">
                      {s.fragen.length}
                    </span>
                    {!istBesitzer && !editierbar && (
                      <span className="text-xs text-ifm-gray">(nur lesen)</span>
                    )}
                  </button>
                  {editierbar && s.tgId && (
                    <button
                      type="button"
                      onClick={() => frageAnlegen(s.tgId!)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-ifm-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-ifm-blue/90"
                    >
                      <PlusIcon className="h-4 w-4" /> Frage
                    </button>
                  )}
                </div>

                {auf && (
                  <div className="border-t border-ifm-lightblue divide-y divide-ifm-lightblue">
                    {s.fragen.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-ifm-gray">Keine Fragen.</p>
                    ) : (
                      s.fragen.map((f, i) => {
                        const richtig = f.antwortoption.filter((o) => o.ist_richtig).length
                        const eigene = f.erstellt_von === user?.id
                        const auf = offeneFragen.has(f.id)
                        const opts = [...f.antwortoption].sort((a, b) => a.sortierung - b.sortierung)
                        return (
                          <div key={f.id} className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <span className="text-ifm-gray text-sm pt-0.5 w-6 text-right">
                                {i + 1}.
                              </span>
                              <button
                                type="button"
                                onClick={() => frageAufklappen(f.id)}
                                className="flex-1 min-w-0 text-left"
                                aria-expanded={auf}
                              >
                                <span className="flex items-start gap-1.5 text-ifm-blue">
                                  <span className="select-none pt-0.5 text-ifm-gray">
                                    {auf ? '▾' : '▸'}
                                  </span>
                                  <span>{f.text}</span>
                                </span>
                                <span className="ml-4 mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                                  <span
                                    className={`rounded-full px-2 py-0.5 font-medium ${
                                      f.typ === 'multi'
                                        ? 'bg-ifm-blue/10 text-ifm-blue'
                                        : 'bg-ifm-green/10 text-ifm-green'
                                    }`}
                                  >
                                    {f.typ === 'multi' ? 'Multi (2 richtig)' : 'Single (1 richtig)'}
                                  </span>
                                  <span className="text-ifm-gray">
                                    {f.antwortoption.length} Optionen · {richtig} richtig
                                  </span>
                                </span>
                              </button>
                              {editierbar && (
                                <div className="flex items-center gap-1 shrink-0">
                                  {(istBesitzer || eigene) && (
                                    <IconButton label="Bearbeiten" onClick={() => setBearbeite(f)}>
                                      <PencilIcon />
                                    </IconButton>
                                  )}
                                  <IconButton
                                    variant="danger"
                                    label={istBesitzer ? 'Löschen' : 'Ausblenden'}
                                    onClick={() => setLoeschKandidat(f)}
                                  >
                                    <TrashIcon />
                                  </IconButton>
                                </div>
                              )}
                            </div>
                            {auf && (
                              <ul className="mt-2 ml-9 space-y-1">
                                {opts.length === 0 ? (
                                  <li className="text-xs text-ifm-gray">Keine Antwortoptionen.</li>
                                ) : (
                                  opts.map((o) => (
                                    <li
                                      key={o.id}
                                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                                        o.ist_richtig ? 'bg-ifm-green/10' : 'bg-ifm-lightblue/30'
                                      }`}
                                    >
                                      <span
                                        className={`w-4 shrink-0 text-center font-bold ${
                                          o.ist_richtig ? 'text-ifm-green' : 'text-transparent'
                                        }`}
                                      >
                                        ✓
                                      </span>
                                      <span
                                        className={o.ist_richtig ? 'text-ifm-green' : 'text-ifm-blue'}
                                      >
                                        {o.text}
                                      </span>
                                    </li>
                                  ))
                                )}
                              </ul>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {bearbeite !== undefined && (
        <FrageModal
          kursId={kursId}
          themengebiete={istBesitzer ? themen : themen.filter((t) => freigegebeneTg.has(t.id))}
          frage={bearbeite}
          vorauswahlThemengebietId={neueFrageTg}
          onClose={() => {
            setBearbeite(undefined)
            setNeueFrageTg(undefined)
          }}
          onSaved={() => {
            setBearbeite(undefined)
            setNeueFrageTg(undefined)
            ladeKursinhalt()
          }}
        />
      )}

      {importOffen && (
        <FragenImportModal
          kursId={kursId}
          onClose={() => setImportOffen(false)}
          onImported={(anzahl) => {
            setImportOffen(false)
            setFehler(null)
            setHinweis(`${anzahl} Fragen importiert.`)
            ladeKursinhalt()
          }}
        />
      )}

      <ConfirmDialog
        open={loeschKandidat !== null}
        title={istBesitzer ? 'Frage löschen' : 'Frage ausblenden'}
        message={
          istBesitzer
            ? 'Diese Frage und ihre Antwortoptionen werden gelöscht.'
            : 'Diese Frage wird nur für dich ausgeblendet. Beim Besitzer des Kurses bleibt sie erhalten.'
        }
        confirmLabel={istBesitzer ? 'Löschen' : 'Ausblenden'}
        busy={loeschBusy}
        onConfirm={loeschenBestaetigt}
        onClose={() => setLoeschKandidat(null)}
      />
    </div>
  )
}
