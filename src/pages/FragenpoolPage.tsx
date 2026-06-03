import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import {
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  IconButton,
} from '../components/ui'
import { PencilIcon, PlusIcon, TrashIcon } from '../components/icons'
import FrageModal, { type FrageMitOptionen } from '../components/FrageModal'
import FragenImportModal from '../components/FragenImportModal'

type Kurs = Tables<'kurs'>
type Themengebiet = Tables<'themengebiet'>
type FrageRow = FrageMitOptionen & { themengebiet: { name: string } | null }

export default function FragenpoolPage() {
  const [kurse, setKurse] = useState<Kurs[]>([])
  const [kursId, setKursId] = useState<string>('')
  const [themen, setThemen] = useState<Themengebiet[]>([])
  const [fragen, setFragen] = useState<FrageRow[]>([])
  const [filterThema, setFilterThema] = useState<string>('')
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweis, setHinweis] = useState<string | null>(null)

  const [bearbeite, setBearbeite] = useState<FrageMitOptionen | null | undefined>(undefined)
  const [importOffen, setImportOffen] = useState(false)
  const [loeschKandidat, setLoeschKandidat] = useState<FrageRow | null>(null)
  const [loeschBusy, setLoeschBusy] = useState(false)

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
  }, [kursId])

  useEffect(() => {
    setFilterThema('')
    ladeKursinhalt()
  }, [ladeKursinhalt])

  async function loeschenBestaetigt() {
    if (!loeschKandidat) return
    setLoeschBusy(true)
    // Antwortoptionen werden per FK (on delete cascade) mitgelöscht
    const { error } = await supabase.from('frage').delete().eq('id', loeschKandidat.id)
    if (error) setFehler(error.message)
    else {
      setFragen((alt) => alt.filter((x) => x.id !== loeschKandidat.id))
      setLoeschKandidat(null)
    }
    setLoeschBusy(false)
  }

  const gefiltert = filterThema
    ? fragen.filter((f) => f.themengebiet_id === filterThema)
    : fragen

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
        <div className="flex items-center gap-2">
          <IconButton
            variant="primary"
            label="Neue Frage"
            onClick={() => setBearbeite(null)}
            disabled={themen.length === 0}
          >
            <PlusIcon />
          </IconButton>
          <button
            type="button"
            onClick={() => setImportOffen(true)}
            className="rounded-lg border border-ifm-gray/40 bg-white px-4 py-2 text-sm font-medium text-ifm-blue hover:bg-ifm-lightblue/50"
          >
            Importieren
          </button>
        </div>
      </div>

      {/* Kurs- und Themengebiet-Auswahl */}
      <div className="flex flex-wrap gap-3 mb-5">
        <label className="block">
          <span className="block text-xs font-medium text-ifm-gray mb-1">Kurs</span>
          <select
            value={kursId}
            onChange={(e) => setKursId(e.target.value)}
            className="rounded-lg border border-ifm-gray/40 px-3 py-2 text-ifm-blue outline-none focus:border-ifm-blue"
          >
            {kurse.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ifm-gray mb-1">Themengebiet</span>
          <select
            value={filterThema}
            onChange={(e) => setFilterThema(e.target.value)}
            className="rounded-lg border border-ifm-gray/40 px-3 py-2 text-ifm-blue outline-none focus:border-ifm-blue"
          >
            <option value="">Alle ({fragen.length})</option>
            {themen.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({fragen.filter((f) => f.themengebiet_id === t.id).length})
              </option>
            ))}
          </select>
        </label>
      </div>

      {hinweis && (
        <div className="mb-4 rounded-lg bg-ifm-green/10 text-ifm-green text-sm p-3">
          {hinweis}
        </div>
      )}

      {fehler && (
        <div className="mb-4">
          <ErrorBanner message={fehler} />
        </div>
      )}

      {themen.length === 0 && (
        <div className="mb-4 rounded-lg bg-ifm-yellow/20 text-ifm-blue text-sm p-3">
          Dieser Kurs hat noch keine Themengebiete. Lege sie im{' '}
          <Link to={`/kurse/${kursId}`} className="font-medium hover:underline">
            Kurs
          </Link>{' '}
          an oder importiere Fragen (Themengebiete werden dann automatisch erstellt).
        </div>
      )}

      {gefiltert.length === 0 ? (
        <EmptyState>Keine Fragen vorhanden.</EmptyState>
      ) : (
        <div className="space-y-3">
          {gefiltert.map((f, i) => {
            const richtig = f.antwortoption.filter((o) => o.ist_richtig).length
            return (
              <Card key={f.id} className="flex items-start gap-4">
                <span className="text-ifm-gray text-sm pt-1 w-6 text-right">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-ifm-blue">{f.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        f.typ === 'multi'
                          ? 'bg-ifm-blue/10 text-ifm-blue'
                          : 'bg-ifm-green/10 text-ifm-green'
                      }`}
                    >
                      {f.typ === 'multi' ? 'Multi (2 richtig)' : 'Single (1 richtig)'}
                    </span>
                    {f.themengebiet?.name && (
                      <span className="rounded-full bg-ifm-lightblue px-2 py-0.5 text-ifm-blue">
                        {f.themengebiet.name}
                      </span>
                    )}
                    <span className="text-ifm-gray">
                      {f.antwortoption.length} Optionen · {richtig} richtig
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <IconButton label="Bearbeiten" onClick={() => setBearbeite(f)}>
                    <PencilIcon />
                  </IconButton>
                  <IconButton
                    variant="danger"
                    label="Löschen"
                    onClick={() => setLoeschKandidat(f)}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {bearbeite !== undefined && (
        <FrageModal
          kursId={kursId}
          themengebiete={themen}
          frage={bearbeite}
          onClose={() => setBearbeite(undefined)}
          onSaved={() => {
            setBearbeite(undefined)
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
        title="Frage löschen"
        message="Diese Frage und ihre Antwortoptionen werden gelöscht."
        busy={loeschBusy}
        onConfirm={loeschenBestaetigt}
        onClose={() => setLoeschKandidat(null)}
      />
    </div>
  )
}
