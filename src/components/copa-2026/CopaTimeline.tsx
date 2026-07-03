'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import type { CopaMatch } from '@/types'
import { isMesmaData, adicionarDias, gerarRangeDias, parsearDataISO } from '@/lib/datas'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ColunaDataJogos } from './ColunaDataJogos'
import { CopaFiltros } from './CopaFiltros'
import { Button } from '../ui/Button'
import type { FiltrosCopaCalendario } from '@/hooks/useCopaCalendario'

interface CopaTimelineProps {
  matches: CopaMatch[]
}

export function CopaTimeline({ matches }: CopaTimelineProps) {
  const hoje = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }, [])

  const [inicioRange, setInicioRange] = useState(() => adicionarDias(hoje, -1))
  const containerRef = useRef<HTMLDivElement>(null)

  const [filtros, setFiltrosState] = useState<FiltrosCopaCalendario>({
    stages: [],
    grupos: [],
    apenasAoVivo: false,
  })

  const fimRange = useMemo(() => adicionarDias(inicioRange, 1 + 16), [inicioRange])
  const diasVisiveis = useMemo(() => gerarRangeDias(inicioRange, fimRange), [inicioRange, fimRange])

  const matchesFiltrados = useMemo(() => {
    return matches.filter((m) => {
      if (filtros.stages.length > 0 && !filtros.stages.includes(m.stage))
        return false
      if (filtros.grupos.length > 0 && !filtros.grupos.includes(m.group ?? ''))
        return false
      return true
    })
  }, [matches, filtros])

  const matchesPorDia = useMemo(() => {
    const map = new Map<string, CopaMatch[]>()
    for (const dia of diasVisiveis) {
      const key = dia.toISOString().split('T')[0]
      const doDia = matchesFiltrados.filter((m) => {
        const dataJogo = parsearDataISO(m.date)
        return isMesmaData(dataJogo, dia)
      })
      if (doDia.length > 0) map.set(key, doDia)
    }
    return map
  }, [diasVisiveis, matchesFiltrados])

  const stagesDisponiveis = useMemo(() => {
    return [...new Set(matches.map((m) => m.stage))]
  }, [matches])

  const gruposDisponiveis = useMemo(() => {
    return [...new Set(matches.map((m) => m.group).filter(Boolean) as string[])]
  }, [matches])

  const setFiltros = (f: Partial<FiltrosCopaCalendario>) => {
    setFiltrosState((prev) => ({ ...prev, ...f }))
  }

  const indexHoje = useMemo(
    () => diasVisiveis.findIndex((d) => isMesmaData(d, hoje)),
    [diasVisiveis, hoje]
  )

  useEffect(() => {
    if (indexHoje >= 0 && containerRef.current) {
      const coluna = containerRef.current.querySelector(`[data-dia-index="${indexHoje}"]`)
      if (coluna) {
        setTimeout(() => {
          coluna.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        }, 100)
      }
    }
  }, [indexHoje])

  return (
    <div className="flex flex-col flex-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <CopaFiltros
          filtros={filtros}
          onChange={setFiltros}
          stages={stagesDisponiveis}
          grupos={gruposDisponiveis}
        />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setInicioRange((p) => adicionarDias(p, -7))} icon={<ChevronLeft size={16} />}>
            Anterior
          </Button>
          <Button variant="secondary" size="sm" onClick={() => {
            const idx = diasVisiveis.findIndex((d) => isMesmaData(d, hoje))
            if (idx >= 0 && containerRef.current) {
              const coluna = containerRef.current.querySelector(`[data-dia-index="${idx}"]`)
              coluna?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
            }
          }}>
            Hoje
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setInicioRange((p) => adicionarDias(p, 7))} icon={<ChevronRight size={16} />}>
            Próximo
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-x-auto overflow-y-auto">
        <div className="flex min-h-full">
          {diasVisiveis.map((data, index) => (
            <ColunaDataJogos
              key={data.toISOString()}
              data={data}
              hoje={hoje}
              matches={matchesPorDia.get(data.toISOString().split('T')[0]) ?? []}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
