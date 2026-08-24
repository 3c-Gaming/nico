'use client'

import { ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, Search } from 'lucide-react'
import { useJogosCalendario } from './useJogosCalendario'
import { ColunaDataJogo } from './ColunaDataJogo'
import { JogosFiltros } from './JogosFiltros'
import { Button } from '../ui/Button'

export function JogosTimeline() {
  const {
    hoje,
    diasVisiveis,
    jogosPorDia,
    carregando,
    erro,
    ligasSelecionadas,
    setLigasSelecionadas,
    filtroTime,
    setFiltroTime,
    avancar,
    recuar,
    irParaHoje,
    containerRef,
    chaveDia,
  } = useJogosCalendario()

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
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
        <div className="px-4 pb-2.5 flex items-center gap-3 flex-wrap">
          <JogosFiltros selecionadas={ligasSelecionadas} onChange={setLigasSelecionadas} />
          <div className="flex items-center gap-1.5 flex-1 min-w-[160px] max-w-xs">
            <Search size={14} className="text-[var(--text-muted)] shrink-0" />
            <input
              type="text"
              value={filtroTime}
              onChange={(e) => setFiltroTime(e.target.value)}
              placeholder="Buscar time…"
              className="flex-1 h-8 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-strong)] transition-colors"
            />
          </div>
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
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
