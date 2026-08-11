'use client'

import type { Jogo } from '@/types'
import { isMesmaData } from '@/lib/datas'
import { CardJogo } from './CardJogo'

interface ColunaDataJogoProps {
  data: Date
  hoje: Date
  jogos: Jogo[]
  index: number
}

export function ColunaDataJogo({ data, hoje, jogos, index }: ColunaDataJogoProps) {
  const isHoje = isMesmaData(data, hoje)
  const isFimDeSemana = data.getDay() === 0 || data.getDay() === 6

  return (
    <div
      data-dia-index={index}
      className={`flex-shrink-0 w-[220px] border-r border-[var(--border)] ${
        isHoje ? 'bg-[var(--d1)]/5' : ''
      } ${isFimDeSemana && !isHoje ? 'bg-black/10' : ''}`}
      style={isHoje ? { borderTop: '2px solid var(--d1)' } : undefined}
    >
      <div
        className={`sticky top-0 z-10 px-3 py-2.5 border-b flex items-center justify-between gap-2 ${
          isHoje ? 'border-[var(--d1)]/30' : 'border-[var(--border)]'
        } bg-[var(--bg-surface)]`}
      >
        <div>
          <div className={`text-xs font-semibold uppercase ${isHoje ? 'text-[var(--d1)]' : 'text-[var(--text-secondary)]'}`}>
            {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'][data.getDay()]}
          </div>
          <div className={`text-lg font-semibold ${isHoje ? 'text-[var(--d1)]' : 'text-[var(--text-primary)]'}`}>
            {data.getDate()}
            {isHoje && <span className="ml-1.5 text-xs font-normal text-[var(--d1)]/70">hoje</span>}
          </div>
        </div>
        {jogos.length > 0 && (
          <span className="text-[10px] text-[var(--text-muted)] font-mono">{jogos.length}</span>
        )}
      </div>

      <div className="p-2 space-y-2 min-h-[200px]">
        {jogos.length === 0 ? (
          <p className="text-[10px] text-[var(--text-muted)]/40 italic px-1 pt-2">Sem jogos</p>
        ) : (
          jogos.map((j) => <CardJogo key={j.id} jogo={j} />)
        )}
      </div>
    </div>
  )
}
