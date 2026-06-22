'use client'

import { useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendario } from './useCalendario'
import { ColunaData } from './ColunaData'
import { CalendarioFiltros } from './CalendarioFiltros'
import { LegendaTipos } from './LegendaTipos'
import { Button } from '../ui/Button'
import { isMesmaData } from '@/lib/datas'

export function CalendarioTimeline() {
  const {
    diasVisiveis,
    hoje,
    disparosPorDia,
    filtros,
    setFiltros,
    irParaHoje,
    avancar,
    recuar,
    containerRef,
  } = useCalendario()

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
  }, [indexHoje, containerRef])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <CalendarioFiltros filtros={filtros} onChange={setFiltros} />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={recuar} icon={<ChevronLeft size={16} />}>
            Anterior
          </Button>
          <Button variant="secondary" size="sm" onClick={irParaHoje}>
            Hoje
          </Button>
          <Button variant="ghost" size="sm" onClick={avancar} icon={<ChevronRight size={16} />}>
            Próximo
          </Button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <LegendaTipos />
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-auto"
      >
        <div className="flex min-h-full">
          {diasVisiveis.map((data, index) => (
            <ColunaData
              key={data.toISOString()}
              data={data}
              hoje={hoje}
              disparos={disparosPorDia.get(data.toISOString().split('T')[0]) ?? []}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
