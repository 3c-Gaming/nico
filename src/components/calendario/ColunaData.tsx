'use client'

import type { Disparo } from '@/types'
import { isMesmaData } from '@/lib/datas'
import { CardDisparo } from './CardDisparo'

interface ColunaDataProps {
  data: Date
  hoje: Date
  disparos: Disparo[]
  index: number
}

export function ColunaData({ data, hoje, disparos, index }: ColunaDataProps) {
  const isHoje = isMesmaData(data, hoje)
  const isFimDeSemana = data.getDay() === 0 || data.getDay() === 6

  return (
    <div
      data-dia-index={index}
      className={`flex-shrink-0 w-[160px] border-r border-[var(--border)] ${
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
        {disparos.map((disparo) => (
          <div key={disparo.id} className="relative">
            <CardDisparo disparo={disparo} />
          </div>
        ))}
      </div>
    </div>
  )
}
