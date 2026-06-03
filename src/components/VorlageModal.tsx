import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { Button, ErrorBanner, Modal, TextInput } from './ui'

type Themengebiet = Tables<'themengebiet'>
type Vorlage = Tables<'pruefungsvorlage'>
type VorlageThemengebiet = Tables<'vorlage_themengebiet'>

export type VorlageMitThemen = Vorlage & {
  vorlage_themengebiet: VorlageThemengebiet[]
}

interface ZeilenWert {
  anzahl_fragen: number
  punkte_gesamt: number
}

export default function VorlageModal({
  kursId,
  themengebiete,
  fragenProThema,
  vorlage,
  onClose,
  onSaved,
}: {
  kursId: string
  themengebiete: Themengebiet[]
  fragenProThema: Record<string, number>
  vorlage: VorlageMitThemen | null
  onClose: () => void
  onSaved: () => void
}) {
  const istNeu = !vorlage
  const [name, setName] = useState(vorlage?.name ?? '')
  const [dauer, setDauer] = useState<number>(vorlage?.dauer_minuten ?? 90)
  const [schwelleGesamt, setSchwelleGesamt] = useState<number>(
    vorlage?.bestehensschwelle_prozent ?? 50,
  )
  const [proThemaAktiv, setProThemaAktiv] = useState<boolean>(
    vorlage?.bestehensschwelle_pro_themengebiet_prozent != null,
  )
  const [schwelleProThema, setSchwelleProThema] = useState<number>(
    vorlage?.bestehensschwelle_pro_themengebiet_prozent ?? 50,
  )

  // Zeilen je Themengebiet (initial aus bestehender Vorlage oder 0)
  const [zeilen, setZeilen] = useState<Record<string, ZeilenWert>>(() => {
    const map: Record<string, ZeilenWert> = {}
    for (const t of themengebiete) {
      const vorhanden = vorlage?.vorlage_themengebiet.find((v) => v.themengebiet_id === t.id)
      map[t.id] = {
        anzahl_fragen: vorhanden?.anzahl_fragen ?? 0,
        punkte_gesamt: vorhanden?.punkte_gesamt ?? 0,
      }
    }
    return map
  })

  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function setZeile(id: string, patch: Partial<ZeilenWert>) {
    setZeilen((alt) => ({ ...alt, [id]: { ...alt[id], ...patch } }))
  }

  const summeFragen = Object.values(zeilen).reduce((s, z) => s + (z.anzahl_fragen || 0), 0)
  const summePunkte = Object.values(zeilen).reduce((s, z) => s + (z.punkte_gesamt || 0), 0)

  function validieren(): string | null {
    if (!name.trim()) return 'Bitte einen Namen eingeben.'
    if (!dauer || dauer <= 0) return 'Die Dauer muss größer als 0 Minuten sein.'
    if (schwelleGesamt < 0 || schwelleGesamt > 100)
      return 'Die Gesamt-Bestehensschwelle muss zwischen 0 und 100 % liegen.'
    if (proThemaAktiv && (schwelleProThema < 0 || schwelleProThema > 100))
      return 'Die Themengebiet-Schwelle muss zwischen 0 und 100 % liegen.'
    if (summeFragen <= 0) return 'Mindestens ein Themengebiet muss Fragen enthalten.'
    for (const t of themengebiete) {
      const z = zeilen[t.id]
      const verfuegbar = fragenProThema[t.id] ?? 0
      if (z.anzahl_fragen < 0 || z.punkte_gesamt < 0)
        return `„${t.name}": keine negativen Werte.`
      if (z.anzahl_fragen > verfuegbar)
        return `„${t.name}": ${z.anzahl_fragen} Fragen gewünscht, aber nur ${verfuegbar} im Pool.`
      if (z.anzahl_fragen > 0 && z.punkte_gesamt <= 0)
        return `„${t.name}": bitte ein Punktegewicht (> 0) angeben.`
    }
    return null
  }

  async function speichern(e: FormEvent) {
    e.preventDefault()
    const v = validieren()
    if (v) {
      setFehler(v)
      return
    }
    setFehler(null)
    setBusy(true)
    const vorlageDaten = {
      kurs_id: kursId,
      name: name.trim(),
      dauer_minuten: dauer,
      bestehensschwelle_prozent: schwelleGesamt,
      bestehensschwelle_pro_themengebiet_prozent: proThemaAktiv ? schwelleProThema : null,
    }
    try {
      let vorlageId = vorlage?.id
      if (istNeu) {
        const { data, error } = await supabase
          .from('pruefungsvorlage')
          .insert(vorlageDaten)
          .select('id')
          .single()
        if (error) throw error
        vorlageId = data.id
      } else {
        const { error } = await supabase
          .from('pruefungsvorlage')
          .update(vorlageDaten)
          .eq('id', vorlageId!)
        if (error) throw error
        const { error: delErr } = await supabase
          .from('vorlage_themengebiet')
          .delete()
          .eq('vorlage_id', vorlageId!)
        if (delErr) throw delErr
      }

      const vtRows = themengebiete
        .filter((t) => zeilen[t.id].anzahl_fragen > 0)
        .map((t) => ({
          vorlage_id: vorlageId!,
          themengebiet_id: t.id,
          anzahl_fragen: zeilen[t.id].anzahl_fragen,
          punkte_gesamt: zeilen[t.id].punkte_gesamt,
        }))
      const { error: vtErr } = await supabase.from('vorlage_themengebiet').insert(vtRows)
      if (vtErr) throw vtErr

      onSaved()
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={istNeu ? 'Neue Prüfungsvorlage' : 'Vorlage bearbeiten'}
    >
      <form onSubmit={speichern} className="space-y-5">
        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. WEG-IHK-Standard"
          required
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NumberField
            label="Dauer (Minuten)"
            value={dauer}
            min={1}
            onChange={setDauer}
          />
          <NumberField
            label="Bestehensschwelle gesamt (%)"
            value={schwelleGesamt}
            min={0}
            max={100}
            onChange={setSchwelleGesamt}
          />
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-ifm-blue mb-1">
              <input
                type="checkbox"
                checked={proThemaAktiv}
                onChange={(e) => setProThemaAktiv(e.target.checked)}
                className="h-4 w-4 accent-ifm-blue"
              />
              Schwelle je Themengebiet
            </label>
            <input
              type="number"
              value={proThemaAktiv ? schwelleProThema : ''}
              min={0}
              max={100}
              disabled={!proThemaAktiv}
              onChange={(e) => setSchwelleProThema(Number(e.target.value))}
              className="w-full rounded-lg border border-ifm-gray/40 px-3 py-2 text-ifm-blue outline-none focus:border-ifm-blue disabled:bg-ifm-lightblue/30 disabled:text-ifm-gray"
              placeholder="%"
            />
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-ifm-blue mb-2">
            Fragen & Punkte je Themengebiet
          </div>
          <div className="overflow-x-auto rounded-lg border border-ifm-lightblue">
            <table className="w-full text-sm">
              <thead className="bg-ifm-lightblue/60 text-ifm-blue">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Themengebiet</th>
                  <th className="text-right px-3 py-2 font-medium">im Pool</th>
                  <th className="text-right px-3 py-2 font-medium">Fragen</th>
                  <th className="text-right px-3 py-2 font-medium">Punkte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ifm-lightblue">
                {themengebiete.map((t) => {
                  const verfuegbar = fragenProThema[t.id] ?? 0
                  const z = zeilen[t.id]
                  const zuViele = z.anzahl_fragen > verfuegbar
                  return (
                    <tr key={t.id}>
                      <td className="px-3 py-2 text-ifm-blue">{t.name}</td>
                      <td
                        className={`px-3 py-2 text-right ${zuViele ? 'text-ifm-red font-medium' : 'text-ifm-gray'}`}
                      >
                        {verfuegbar}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={z.anzahl_fragen}
                          onChange={(e) =>
                            setZeile(t.id, { anzahl_fragen: Math.max(0, Number(e.target.value)) })
                          }
                          className={`w-20 rounded-lg border px-2 py-1 text-right text-ifm-blue outline-none focus:border-ifm-blue ${
                            zuViele ? 'border-ifm-red' : 'border-ifm-gray/40'
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={z.punkte_gesamt}
                          onChange={(e) =>
                            setZeile(t.id, { punkte_gesamt: Math.max(0, Number(e.target.value)) })
                          }
                          className="w-20 rounded-lg border border-ifm-gray/40 px-2 py-1 text-right text-ifm-blue outline-none focus:border-ifm-blue"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-ifm-lightblue/30 text-ifm-blue font-medium">
                <tr>
                  <td className="px-3 py-2">Summe</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right">{summeFragen}</td>
                  <td className="px-3 py-2 text-right">{summePunkte}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {themengebiete.length === 0 && (
            <p className="mt-2 text-sm text-ifm-gray">
              Dieser Kurs hat noch keine Themengebiete.
            </p>
          )}
        </div>

        {fehler && <ErrorBanner message={fehler} />}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Speichern …' : 'Speichern'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ifm-blue mb-1">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-ifm-gray/40 px-3 py-2 text-ifm-blue outline-none focus:border-ifm-blue focus:ring-2 focus:ring-ifm-blue/20"
      />
    </label>
  )
}
