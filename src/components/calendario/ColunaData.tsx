'use client'

import { useCallback, useMemo, useState } from 'react'
import type { ItemCalendario } from '@/types'
import { isMesmaData, formatarData } from '@/lib/datas'
import { CardItemCalendario } from './CardDisparo'
import type { ResultadoContribuicaoDia } from './CardDisparo'
import { StatNumber } from '../ui/StatNumber'

interface ColunaDataProps {
  data: Date
  hoje: Date
  disparos: ItemCalendario[]
  index: number
}

export function ColunaData({ data, hoje, disparos, index }: ColunaDataProps) {
  const isHoje = isMesmaData(data, hoje)
  const isFimDeSemana = data.getDay() === 0 || data.getDay() === 6
  const diaAindaNaoFechou = formatarData(data, 'YYYY-MM-DD') >= formatarData(hoje, 'YYYY-MM-DD')

  // Cada CardItemCalendario reporta seu resultado (só disparos já cadastrados) via
  // reportarResultado, referência estável (useCallback, sem deps via updater funcional)
  // pra não causar loop de re-render entre pai e filhos.
  const [resultados, setResultados] = useState<Map<string, ResultadoContribuicaoDia | null>>(new Map())

  const reportarResultado = useCallback((id: string, r: ResultadoContribuicaoDia | null) => {
    setResultados((prev) => {
      const atual = prev.get(id) ?? null
      if (JSON.stringify(atual) === JSON.stringify(r)) return prev
      const proximo = new Map(prev)
      proximo.set(id, r)
      return proximo
    })
  }, [])

  const resumo = useMemo(() => {
    let registros = 0
    let ftds = 0
    let cpas = 0
    let custo = 0
    let receita = 0
    let contribuintes = 0
    for (const item of disparos) {
      const r = resultados.get(item.id)
      if (!r) continue
      contribuintes++
      registros += r.registros
      ftds += r.ftds
      custo += r.custo
      if (r.cpas != null) {
        cpas += r.cpas
        receita += r.receita
      }
    }
    const roi = custo > 0 && receita > 0 ? receita / custo : null
    return { registros, ftds, cpas, custo, roi, contribuintes }
  }, [disparos, resultados])

  return (
    <div
      data-dia-index={index}
      className={`flex-shrink-0 w-[260px] border-r border-[var(--border)] ${
        isHoje ? 'bg-[var(--success)]/5' : ''
      } ${isFimDeSemana && !isHoje ? 'bg-black/10' : ''}`}
      style={isHoje ? { borderTop: '2px solid var(--success)' } : undefined}
    >
      <div
        className={`sticky top-0 z-10 px-3 py-1.5 border-b flex items-start justify-between gap-2 ${
          isHoje ? 'border-[var(--success)]/30' : 'border-[var(--border)]'
        } bg-[var(--bg-surface)]`}
        style={isHoje ? { backgroundColor: 'var(--bg-surface)' } : undefined}
      >
        <div>
          <div className={`text-xs font-semibold uppercase ${
            isHoje ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'
          }`}>
            {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'][data.getDay()]}
          </div>
          <div className={`text-lg font-semibold ${
            isHoje ? 'text-[var(--success)]' : 'text-[var(--text-primary)]'
          }`}>
            {data.getDate()}
            {isHoje && (
              <span className="ml-1.5 text-xs font-normal text-[var(--success)]/70">hoje</span>
            )}
          </div>
        </div>

        {resumo.contribuintes > 0 && (
          diaAindaNaoFechou ? (
            <div className="text-right pt-0.5 flex flex-col items-end leading-tight">
              <span className="text-[12px] text-[var(--text-primary)] font-bold whitespace-nowrap">
               Custo <StatNumber value={resumo.custo} prefix="R$ " decimals={2} />
              </span>
              <span className="text-sm font-bold text-[var(--text-muted)]">—</span>
              <span className="text-[10px] font-semibold text-[var(--text-primary)] whitespace-nowrap">
                <StatNumber value={resumo.registros} /> REG · <StatNumber value={resumo.ftds} /> FTD
              </span>
            </div>
          ) : (
            <div className="text-right pt-0.5 flex flex-col items-end leading-tight">
              <span className="text-[12px] font-bold text-[var(--text-primary)]">
                Custo <StatNumber value={resumo.custo} prefix="R$ " decimals={2} />
              </span>
              {resumo.roi != null ? (
                <span className={`text-sm font-bold ${resumo.roi >= 1 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                 ROI <StatNumber value={resumo.roi} suffix="x" decimals={Number.isInteger(resumo.roi) ? 0 : 1} />
                </span>
              ) : (
                <span className="text-sm font-bold text-[var(--text-muted)]">—</span>
              )}
              <span className="text-[10px] text-[var(--text-primary)] whitespace-nowrap">
                <StatNumber value={resumo.registros} /> REG · <StatNumber value={resumo.ftds} /> FTD · <StatNumber value={resumo.cpas} /> CPA
              </span>
            </div>
          )
        )}
      </div>

      <div className="p-4 space-y-2 min-h-[200px]">
        {disparos.map((item) => (
          <div key={item.id} className="relative">
            <CardItemCalendario item={item} onResultado={reportarResultado} />
          </div>
        ))}
      </div>
    </div>
  )
}
