export type PruefungStatus = 'entwurf' | 'lobby' | 'laeuft' | 'beendet'

export const STATUS_LABEL: Record<PruefungStatus, string> = {
  entwurf: 'Entwurf',
  lobby: 'Lobby',
  laeuft: 'Läuft',
  beendet: 'Beendet',
}

const STATUS_STYLE: Record<PruefungStatus, string> = {
  entwurf: 'bg-ifm-gray/15 text-ifm-gray',
  lobby: 'bg-ifm-yellow/25 text-ifm-blue',
  laeuft: 'bg-ifm-green/15 text-ifm-green',
  beendet: 'bg-ifm-blue/10 text-ifm-blue',
}

export function StatusBadge({ status }: { status: string }) {
  const s = (status as PruefungStatus) in STATUS_LABEL ? (status as PruefungStatus) : 'entwurf'
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[s]}`}
    >
      {STATUS_LABEL[s]}
    </span>
  )
}
