import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import type { Tables } from '../lib/database.types'
import { Card, EmptyState, ErrorBanner, IconButton } from '../components/ui'
import { PlusIcon } from '../components/icons'
import NeuePruefungModal, { type VorlageOption } from '../components/NeuePruefungModal'
import { StatusBadge } from '../components/pruefungStatus'

type PruefungRow = Tables<'pruefung'> & {
  pruefungsvorlage: { name: string; kurs: { name: string } | null } | null
}

export default function PruefungenPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pruefungen, setPruefungen] = useState<PruefungRow[]>([])
  const [vorlagen, setVorlagen] = useState<VorlageOption[]>([])
  const [laden, setLaden] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [modalOffen, setModalOffen] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [pRes, vRes] = await Promise.all([
        supabase
          .from('pruefung')
          .select('*, pruefungsvorlage(name, kurs(name))')
          .order('created_at', { ascending: false })
          .returns<PruefungRow[]>(),
        supabase
          .from('pruefungsvorlage')
          .select('id, name, kurs_id, kurs(name)')
          .returns<{ id: string; name: string; kurs_id: string; kurs: { name: string } | null }[]>(),
      ])
      if (pRes.error) setFehler(pRes.error.message)
      else if (pRes.data) setPruefungen(pRes.data)
      if (vRes.error) setFehler(vRes.error.message)
      else if (vRes.data)
        setVorlagen(
          vRes.data.map((v) => ({
            id: v.id,
            name: v.name,
            kurs_id: v.kurs_id,
            kursName: v.kurs?.name ?? '—',
          })),
        )
      setLaden(false)
    })()
  }, [])

  if (laden) return <p className="text-ifm-gray">Lädt …</p>

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ifm-blue">Prüfungen</h1>
          <p className="mt-1 text-ifm-gray">
            Konkrete Prüfungssitzungen aus deinen Vorlagen.
          </p>
        </div>
        <span data-tour="pr-neue">
          <IconButton
            variant="primary"
            label="Neue Prüfung"
            onClick={() => setModalOffen(true)}
            disabled={vorlagen.length === 0}
          >
            <PlusIcon />
          </IconButton>
        </span>
      </div>

      {fehler && (
        <div className="mb-4">
          <ErrorBanner message={fehler} />
        </div>
      )}

      {vorlagen.length === 0 && (
        <div className="mb-4 rounded-lg bg-ifm-yellow/20 text-ifm-blue text-sm p-3">
          Du brauchst zuerst eine{' '}
          <Link to="/vorlagen" className="font-medium hover:underline">
            Prüfungsvorlage
          </Link>
          , um eine Prüfung zu erstellen.
        </div>
      )}

      {pruefungen.length === 0 ? (
        <EmptyState>Noch keine Prüfungen.</EmptyState>
      ) : (
        <div className="space-y-3">
          {pruefungen.map((p) => (
            <Link key={p.id} to={`/pruefungen/${p.id}`} className="block">
              <Card className="flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
                <div className="min-w-0">
                  <div className="font-semibold text-ifm-blue truncate">
                    {p.pruefungsvorlage?.name ?? 'Prüfung'}
                  </div>
                  <div className="text-sm text-ifm-gray">
                    {p.pruefungsvorlage?.kurs?.name ?? '—'}
                    {p.datum && ` · ${new Date(p.datum).toLocaleDateString('de-DE')}`}
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </Card>
            </Link>
          ))}
        </div>
      )}

      {modalOffen && user && (
        <NeuePruefungModal
          vorlagen={vorlagen}
          ownerId={user.id}
          onClose={() => setModalOffen(false)}
          onCreated={(id) => navigate(`/pruefungen/${id}`)}
        />
      )}
    </div>
  )
}
