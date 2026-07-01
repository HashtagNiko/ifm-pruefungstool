import type { DetailFrage, ErgebnisDetail } from '../lib/teilnehmerApi'

/** Zeigt einem Teilnehmer nach Abgabe an, was er je Frage richtig/falsch beantwortet hat. */
export default function ErgebnisDetailListe({ detail }: { detail: ErgebnisDetail }) {
  return (
    <div className="mt-6 space-y-4 text-left">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ifm-gray">
        Deine Antworten im Detail
      </h2>
      {detail.fragen.map((f) => (
        <FrageBlock key={f.pruefung_frage_id} frage={f} />
      ))}
    </div>
  )
}

function FrageBlock({ frage }: { frage: DetailFrage }) {
  const gewaehlt = new Set(frage.gewaehlt)
  const richtigeIds = frage.optionen.filter((o) => o.ist_richtig).map((o) => o.id)
  const richtigGewaehlt = richtigeIds.filter((id) => gewaehlt.has(id)).length
  const falschGewaehlt = frage.gewaehlt.filter((id) => !richtigeIds.includes(id)).length
  const vollRichtig =
    richtigGewaehlt === richtigeIds.length && falschGewaehlt === 0 && frage.gewaehlt.length > 0
  const teilweise = !vollRichtig && richtigGewaehlt > 0 && falschGewaehlt === 0

  const status = vollRichtig
    ? { text: 'Richtig', cls: 'bg-ifm-green/15 text-ifm-green' }
    : teilweise
      ? { text: 'Teilweise', cls: 'bg-ifm-yellow/25 text-ifm-blue' }
      : { text: 'Falsch', cls: 'bg-ifm-red/15 text-ifm-red' }

  return (
    <div className="rounded-xl border border-ifm-gray/20 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-ifm-gray">
          Frage {frage.sortierung + 1}
          {frage.themengebiet ? ` · ${frage.themengebiet}` : ''}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>
          {status.text}
        </span>
      </div>
      <p className="mb-3 font-medium text-ifm-blue">{frage.text}</p>
      <ul className="space-y-1.5">
        {frage.optionen.map((o) => {
          const chosen = gewaehlt.has(o.id)
          let cls = 'border-ifm-gray/20 text-ifm-gray'
          let marke = ''
          if (o.ist_richtig && chosen) {
            cls = 'border-ifm-green/40 bg-ifm-green/10 text-ifm-blue'
            marke = '✓ deine Antwort – richtig'
          } else if (o.ist_richtig && !chosen) {
            cls = 'border-ifm-green/40 bg-ifm-green/5 text-ifm-blue'
            marke = 'richtige Antwort'
          } else if (!o.ist_richtig && chosen) {
            cls = 'border-ifm-red/40 bg-ifm-red/10 text-ifm-blue'
            marke = '✗ deine Antwort – falsch'
          }
          return (
            <li
              key={o.id}
              className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${cls}`}
            >
              <span>{o.text}</span>
              {marke && <span className="shrink-0 text-xs font-medium">{marke}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
