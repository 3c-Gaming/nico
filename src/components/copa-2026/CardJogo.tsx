'use client'

import type { CopaMatch } from '@/types'

interface CardJogoProps {
  match: CopaMatch
}

function formatarHorarioBrasilia(utcIso: string): string {
  if (!utcIso) return ''
  try {
    const d = new Date(utcIso.endsWith('Z') ? utcIso : utcIso + 'Z')
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return utcIso
  }
}

export function CardJogo({ match }: CardJogoProps) {
  const temPlacar = match.homeScore != null && match.awayScore != null
  const finalizado = match.status === 'finished'
  const horario = formatarHorarioBrasilia(match.date)

  return (
    <div
      className={`rounded border-l-[3px] p-2.5 transition-colors ${
        finalizado
          ? 'border-green-500 bg-green-500/5'
          : 'border-blue-500 bg-[var(--bg-elevated)]/30'
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className={`text-[10px] font-medium uppercase tracking-wider ${
          finalizado ? 'text-green-500' : 'text-blue-400'
        }`}>
          {finalizado ? 'Encerrado' : horario}
        </span>
        <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[80px]">
          {match.stage}{match.group ? ` (${match.group})` : ''}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mb-1">
        {match.homeLogo && (
          <img src={match.homeLogo} alt="" className="w-5 h-5 object-contain shrink-0" />
        )}
        <span className="text-xs font-semibold text-[var(--text-primary)] truncate flex-1 text-right">
          {match.homeTeam}
        </span>
      </div>

      <div className="flex items-center justify-center gap-1 my-0.5">
        {temPlacar ? (
          <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
            {match.homeScore} × {match.awayScore}
          </span>
        ) : (
          <span className="text-[10px] text-[var(--text-muted)]">vs</span>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-xs font-semibold text-[var(--text-primary)] truncate flex-1">
          {match.awayTeam}
        </span>
        {match.awayLogo && (
          <img src={match.awayLogo} alt="" className="w-5 h-5 object-contain shrink-0" />
        )}
      </div>

      {match.venue && (
        <div className="mt-1.5 text-[10px] text-[var(--text-muted)] truncate">
          {match.venue}{match.city ? `, ${match.city}` : ''}
        </div>
      )}
    </div>
  )
}
