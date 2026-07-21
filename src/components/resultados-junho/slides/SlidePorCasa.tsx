'use client'

import type { ResultadosJunho2026 } from '@/types'
import { SlideShell, SlideItem } from '../SlideShell'
import { BarraComparativa } from '../BarraComparativa'
import { CORES_CASA, formatarMoeda } from '../formato'

export function SlidePorCasa({ dados }: { dados: ResultadosJunho2026 }) {
  const casas = Object.entries(dados.porCasa).sort((a, b) => b[1].lucro - a[1].lucro)
  const [melhorCasa] = casas[0]

  return (
    <SlideShell
      eyebrow="Resultados Por casa"
      titulo={`${melhorCasa} como foco para CPA`}
      subtitulo="Comparativo de lucro por casa de destino nos disparos"
    >
      <SlideItem className="w-full">
        <BarraComparativa
          itens={casas.map(([casa, agg]) => ({
            label: casa,
            valor: agg.lucro,
            cor: 'var(--success)',
            destaque: formatarMoeda(agg.lucro),
          }))}
        />
      </SlideItem>

      <SlideItem className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
        {casas.map(([casa, agg]) => (
          <div
            key={casa}
            className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 text-left"
            style={{ borderLeft: `3px solid ${CORES_CASA[casa] ?? 'var(--d1)'}` }}
          >
            <div className="text-sm font-bold mb-2" style={{ color: CORES_CASA[casa] ?? 'var(--d1)' }}>
              {casa}
            </div>
            <div className="text-xs text-[var(--text-primary)] space-y-1">
              <div>{agg.disparos} Disparos Efetuados</div>
              <div>{agg.entregues.toLocaleString('pt-BR')} Mensagens entregues</div>
              <div>{agg.cpas} CPAs</div>
              <div>ROAS {agg.roas.toFixed(2)}x</div>
            </div>
          </div>
        ))}
      </SlideItem>
    </SlideShell>
  )
}
