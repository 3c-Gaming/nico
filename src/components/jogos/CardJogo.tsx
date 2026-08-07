'use client'

import type { Jogo } from '@/types'

function formatarHorarioBrasilia(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

const STATUS_ESTILO: Record<Jogo['status'], { borda: string; texto: string }> = {
  scheduled: { borda: 'border-blue-500', texto: 'text-blue-400' },
  live: { borda: 'border-red-500', texto: 'text-red-500' },
  finished: { borda: 'border-green-500', texto: 'text-green-500' },
  postponed: { borda: 'border-[var(--text-muted)]', texto: 'text-[var(--text-muted)]' },
  cancelled: { borda: 'border-[var(--text-muted)]', texto: 'text-[var(--text-muted)]' },
}

function rotuloStatus(jogo: Jogo): string {
  switch (jogo.status) {
    case 'finished': return 'Encerrado'
    case 'live': return jogo.elapsed != null ? `${jogo.elapsed}'` : 'Ao vivo'
    case 'postponed': return 'Adiado'
    case 'cancelled': return 'Cancelado'
    default: return formatarHorarioBrasilia(jogo.date)
  }
}

export function CardJogo({ jogo }: { jogo: Jogo }) {
  const temPlacar = jogo.homeScore != null && jogo.awayScore != null
  const { borda, texto } = STATUS_ESTILO[jogo.status]

  return (
    <div className={`rounded border-l-[3px] p-2.5 bg-[var(--bg-elevated)]/30 transition-colors ${borda}`}>
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${texto} ${jogo.status === 'live' ? 'animate-pulse' : ''}`}>
          {rotuloStatus(jogo)}
        </span>
        <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[90px]" title={jogo.ligaNome}>
          {jogo.ligaNome}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mb-1">
        {jogo.homeLogo && <img src={jogo.homeLogo} alt="" className="w-5 h-5 object-contain shrink-0" />}
        <span className="text-xs font-semibold text-[var(--text-primary)] truncate flex-1 text-right">
          {jogo.homeTeam}
        </span>
      </div>

      <div className="flex items-center justify-center gap-1 my-0.5">
        {temPlacar ? (
          <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
            {jogo.homeScore} × {jogo.awayScore}
          </span>
        ) : (
          <span className="text-[10px] text-[var(--text-muted)]">vs</span>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-xs font-semibold text-[var(--text-primary)] truncate flex-1">
          {jogo.awayTeam}
        </span>
        {jogo.awayLogo && <img src={jogo.awayLogo} alt="" className="w-5 h-5 object-contain shrink-0" />}
      </div>

      {jogo.venue && (
        <div className="mt-1.5 text-[10px] text-[var(--text-muted)] truncate">
          {jogo.venue}{jogo.city ? `, ${jogo.city}` : ''}
        </div>
      )}
    </div>
  )
}
