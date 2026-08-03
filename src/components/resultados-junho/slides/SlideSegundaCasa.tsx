'use client'

import type { ItemSegundaCasa } from '@/types'
import { SlideShell, SlideItem } from '../SlideShell'
import { CORES_CASA, formatarMoeda, formatarNumero } from '../formato'

// Tailwind precisa das classes literais no bundle — por isso um mapa fixo em vez de interpolar o número.
const GRID_COLS_POR_QTD: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
}

export function SlideSegundaCasa({ itens }: { itens: ItemSegundaCasa[] }) {
  const totalFaturamento = itens.reduce((s, d) => s + d.faturamento, 0)
  const gridCols = GRID_COLS_POR_QTD[itens.length] ?? 'grid-cols-1 md:grid-cols-4'

  return (
    <SlideShell
      eyebrow="Destaque do período"
      titulo="Segunda casa"
      subtitulo="Registros, FTDs e faturamento de usuários que já tinham cadastro ou aproveitaram uma oferta complementar em outra casa — sem custo de disparo próprio, potencializando o LTV da base."
    >
      <SlideItem className={`grid ${gridCols} gap-3 w-full`}>
        {itens.map((item) => (
          <div
            key={item.casa}
            className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-2.5 sm:p-4 text-left"
            style={{ borderLeft: `3px solid ${CORES_CASA[item.casa] ?? 'var(--d1)'}` }}
          >
            <div className="text-sm font-bold mb-2" style={{ color: CORES_CASA[item.casa] ?? 'var(--d1)' }}>
              {item.casa}
            </div>
            <div className="text-[11px] sm:text-xs text-[var(--text-primary)] space-y-1">
              <div>{formatarMoeda(item.faturamento)} de faturamento</div>
              <div>Lucro livre — oferta extra (tipo order bump), sem custo de disparo</div>
              <div className="grid grid-cols-3 gap-1 sm:gap-2 border border-[var(--glass-border)] rounded">
                <div className="p-1.5 sm:p-4 text-center">
                  <b>{formatarNumero(item.registros)}</b>
                  <p>REG</p>
                </div>
                <div className="p-1.5 sm:p-4 text-center">
                  <b>{formatarNumero(item.ftd)}</b>
                  <p>FTDs</p>
                </div>
                <div className="p-1.5 sm:p-4 text-center">
                  <b>{formatarNumero(item.cpas)}</b>
                  <p>CPAs</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </SlideItem>

      <SlideItem className="w-full">
        <div className="rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-3 text-sm text-[var(--text-secondary)] text-center">
          {formatarMoeda(totalFaturamento)} somados ao faturamento total do período, direto de lucro já que não houve custo de disparo dedicado.
        </div>
      </SlideItem>
    </SlideShell>
  )
}
