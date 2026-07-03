'use client'

import type { CopaMatch } from '@/types'
import { isMesmaData } from '@/lib/datas'
import { CardJogo } from './CardJogo'

interface ColunaDataJogosProps {
  data: Date
  hoje: Date
  matches: CopaMatch[]
  index: number
}

export function ColunaDataJogos({ data, hoje, matches, index }: ColunaDataJogosProps) {
  const isHoje = isMesmaData(data, hoje)
  const isFimDeSemana = data.getDay() === 0 || data.getDay() === 6

  return (
    <div
      data-dia-index={index}
      className={`flex-shrink-0 w-[180px] border-r border-[var(--border)] ${
        isHoje ? 'bg-[var(--d1)]/5' : ''
      } ${isFimDeSemana && !isHoje ? 'bg-black/10' : ''}`}
      style={isHoje ? { borderTop: '2px solid var(--d1)' } : undefined}
    >
      <div
        className={`sticky top-0 z-10 px-3 py-2.5 border-b ${
          isHoje ? 'border-[var(--d1)]/30' : 'border-[var(--border)]'
        } bg-[var(--bg-surface)]`}
        style={isHoje ? { backgroundColor: 'var(--bg-surface)' } : undefined}
      >
        <div className={`text-xs font-semibold uppercase ${
          isHoje ? 'text-[var(--d1)]' : 'text-[var(--text-secondary)]'
        }`}>
          {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'][data.getDay()]}
        </div>
        <div className={`text-lg font-semibold ${
          isHoje ? 'text-[var(--d1)]' : 'text-[var(--text-primary)]'
        }`}>
          {data.getDate()}
          {isHoje && (
            <span className="ml-1.5 text-xs font-normal text-[var(--d1)]/70">hoje</span>
          )}
        </div>
      </div>

      <div className="p-2 space-y-2 min-h-[200px]">
        {matches.map((m) => (
          <div key={m.id} className="relative">
            <CardJogo match={m} />
          </div>
        ))}
      </div>
    </div>
  )
}
