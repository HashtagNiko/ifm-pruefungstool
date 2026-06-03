import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { Card, ConfirmDialog, EmptyState, ErrorBanner, IconButton } from '../components/ui'
import { PencilIcon, PlusIcon, TrashIcon } from '../components/icons'
import VorlageModal, { type VorlageMitThemen } from '../components/VorlageModal'

type Kurs = Tables<'kurs'>
type Themengebiet = Tables<'themengebiet'>

export default function VorlagenPage() {
  const [kurse, setKurse] = useState<Kurs[]>([])
  const [kursId, setKursId] = useState('')
  const [themen, setThemen] = useState<Themengebiet[]>([])
  const [fragenProThema, setFragenProThema] = useState<Record<string, number>>({})
  const [vorlagen, setVorlagen] = useState<VorlageMitThemen[]>([])
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)

  const [bearbeite, setBearbeite] = useState<VorlageMitThemen | null | undefined>(undefined)
  const [loeschKandidat, setLoeschKandidat] = useState<VorlageMitThemen | null>(null)
  const [loeschBusy, setLoeschBusy] = useState(false)

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
    const [tRes, fRes, vRes] = await Promise.all([
      supabase
        .from('themengebiet')
        .select('*')
        .eq('kurs_id', kursId)
        .order('sortierung', { ascending: true }),
      supabase.from('frage').select('themengebiet_id').eq('kurs_id', kursId),
      supabase
        .from('pruefungsvorlage')
        .select('*, vorlage_themengebiet(*)')
        .eq('kurs_id', kursId)
        .order('created_at', { ascending: true })
        .returns<VorlageMitThemen[]>(),
    ])
    if (tRes.error) setFehler(tRes.error.message)
    else if (tRes.data) setThemen(tRes.data)
    if (fRes.error) setFehler(fRes.error.message)
    else if (fRes.data) {
      const zaehler: Record<string, number> = {}
      for (const row of fRes.data) {
        if (row.themengebiet_id)
          zaehler[row.themengebiet_id] = (zaehler[row.themengebiet_id] ?? 0) + 1
      }
      setFragenProThema(zaehler)
    }
    if (vRes.error) setFehler(vRes.error.message)
    else if (vRes.data) setVorlagen(vRes.data)
  }, [kursId])

  useEffect(() => {
    ladeKursinhalt()
  }, [ladeKursinhalt])

  async function loeschenBestaetigt() {
    if (!loeschKandidat) return
    setLoeschBusy(true)
    const { error } = await supabase
      .from('pruefungsvorlage')
      .delete()
      .eq('id', loeschKandidat.id)
    if (error) setFehler(error.message)
    else {
      setVorlagen((alt) => alt.filter((x) => x.id !== loeschKandidat.id))
      setLoeschKandidat(null)
    }
    setLoeschBusy(false)
  }

  if (laden) return <p className="text-ifm-gray">Lädt …</p>

  if (kurse.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ifm-blue">Vorlagen</h1>
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
          <h1 className="text-2xl font-bold text-ifm-blue">Prüfungsvorlagen</h1>
          <p className="mt-1 text-ifm-gray">
            Bauplan für Prüfungen: Dauer, Bestehensschwellen und Fragen je Themengebiet.
          </p>
        </div>
        <IconButton
          variant="primary"
          label="Neue Vorlage"
          onClick={() => setBearbeite(null)}
          disabled={themen.length === 0}
        >
          <PlusIcon />
        </IconButton>
      </div>

      <label className="block mb-5">
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

      {fehler && (
        <div className="mb-4">
          <ErrorBanner message={fehler} />
        </div>
      )}

      {themen.length === 0 && (
        <div className="mb-4 rounded-lg bg-ifm-yellow/20 text-ifm-blue text-sm p-3">
          Dieser Kurs hat noch keine Themengebiete/Fragen. Lege erst den{' '}
          <Link to="/fragenpool" className="font-medium hover:underline">
            Fragenpool
          </Link>{' '}
          an.
        </div>
      )}

      {vorlagen.length === 0 ? (
        <EmptyState>Noch keine Vorlagen.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {vorlagen.map((v) => {
            const summeFragen = v.vorlage_themengebiet.reduce((s, z) => s + z.anzahl_fragen, 0)
            const summePunkte = v.vorlage_themengebiet.reduce((s, z) => s + z.punkte_gesamt, 0)
            return (
              <Card key={v.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-ifm-blue">{v.name}</h2>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconButton label="Bearbeiten" onClick={() => setBearbeite(v)}>
                      <PencilIcon />
                    </IconButton>
                    <IconButton
                      variant="danger"
                      label="Löschen"
                      onClick={() => setLoeschKandidat(v)}
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                </div>
                <dl className="mt-2 text-sm text-ifm-gray space-y-1">
                  <div className="flex gap-2">
                    <dt>Dauer:</dt>
                    <dd className="text-ifm-blue">{v.dauer_minuten} Min.</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>Bestehensschwelle:</dt>
                    <dd className="text-ifm-blue">
                      {v.bestehensschwelle_prozent} % gesamt
                      {v.bestehensschwelle_pro_themengebiet_prozent != null &&
                        ` · ${v.bestehensschwelle_pro_themengebiet_prozent} % je Themengebiet`}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>Umfang:</dt>
                    <dd className="text-ifm-blue">
                      {summeFragen} Fragen · {summePunkte} Punkte ·{' '}
                      {v.vorlage_themengebiet.length} Themengebiete
                    </dd>
                  </div>
                </dl>
              </Card>
            )
          })}
        </div>
      )}

      {bearbeite !== undefined && (
        <VorlageModal
          kursId={kursId}
          themengebiete={themen}
          fragenProThema={fragenProThema}
          vorlage={bearbeite}
          onClose={() => setBearbeite(undefined)}
          onSaved={() => {
            setBearbeite(undefined)
            ladeKursinhalt()
          }}
        />
      )}

      <ConfirmDialog
        open={loeschKandidat !== null}
        title="Vorlage löschen"
        message={
          <>
            Vorlage <strong>{loeschKandidat?.name}</strong> wirklich löschen? Das ist nur
            möglich, wenn keine Prüfung diese Vorlage verwendet.
          </>
        }
        busy={loeschBusy}
        onConfirm={loeschenBestaetigt}
        onClose={() => setLoeschKandidat(null)}
      />
    </div>
  )
}
