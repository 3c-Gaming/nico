'use client'

import { ChevronLeft, ChevronRight, RefreshCw, AlertTriangle } from 'lucide-react'
import { useJogosCalendario } from './useJogosCalendario'
import { ColunaDataJogo } from './ColunaDataJogo'
import { JogosFiltros } from './JogosFiltros'
import { Button } from '../ui/Button'

export function JogosTimeline() {
  const {
    hoje,
    diasVisiveis,
    jogosPorDia,
    diasBloqueados,
    carregando,
    erro,
    ligasSelecionadas,
    setLigasSelecionadas,
    avancar,
    recuar,
    irParaHoje,
    containerRef,
    chaveDia,
  } = useJogosCalendario()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-3">
          <JogosFiltros selecionadas={ligasSelecionadas} onChange={setLigasSelecionadas} />
          {carregando && <RefreshCw size={14} className="animate-spin text-[var(--text-muted)]" />}
          {erro && (
            <span className="flex items-center gap-1 text-xs text-[var(--error)]">
              <AlertTriangle size={12} />
              {erro}
            </span>
          )}
        </div>
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

      <div ref={containerRef} className="flex-1 overflow-x-auto overflow-y-auto">
        <div className="flex min-h-full">
          {diasVisiveis.map((data, index) => (
            <ColunaDataJogo
              key={data.toISOString()}
              data={data}
              hoje={hoje}
              jogos={jogosPorDia.get(chaveDia(data)) ?? []}
              bloqueado={diasBloqueados.has(chaveDia(data))}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
