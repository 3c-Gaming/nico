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

const STATUS_PILL: Record<Jogo['status'], string> = {
  scheduled: 'bg-blue-500/15 text-blue-400',
  live: 'bg-red-500/15 text-red-500',
  finished: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
  postponed: 'bg-[var(--bg-elevated)] text-[var(--text-muted)]',
  cancelled: 'bg-[var(--bg-elevated)] text-[var(--text-muted)]',
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

function LinhaTime({ nome, logo, valor }: { nome: string; logo?: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- CDN externa (football-data.org), sem domínio fixo pra configurar no next/image
          <img src={logo} alt="" className="w-5 h-5 object-contain shrink-0" />
        ) : (
          <span className="w-5 h-5 shrink-0" />
        )}
        <span className="text-xs font-medium text-[var(--text-primary)] truncate">{nome}</span>
      </div>
      <span className="text-xs font-semibold text-[var(--text-secondary)] tabular-nums shrink-0">{valor}</span>
    </div>
  )
}

export function CardJogo({ jogo }: { jogo: Jogo }) {
  const temPlacar = jogo.homeScore != null && jogo.awayScore != null

  return (
    <div className="rounded-lg bg-[var(--bg-elevated)]/40 border border-[var(--border)] p-3">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="text-[10px] text-[var(--text-muted)] truncate" title={jogo.ligaNome}>
          {jogo.ligaNome}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${STATUS_PILL[jogo.status]} ${jogo.status === 'live' ? 'animate-pulse' : ''}`}>
          {rotuloStatus(jogo)}
        </span>
      </div>

      <div className="space-y-1.5">
        <LinhaTime nome={jogo.homeTeam} logo={jogo.homeLogo} valor={temPlacar ? String(jogo.homeScore) : '-'} />
        <LinhaTime nome={jogo.awayTeam} logo={jogo.awayLogo} valor={temPlacar ? String(jogo.awayScore) : '-'} />
      </div>
    </div>
  )
}
