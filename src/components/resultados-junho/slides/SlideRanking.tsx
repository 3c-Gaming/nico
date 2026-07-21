'use client'

import { motion } from 'framer-motion'
import type { ResultadosJunho2026 } from '@/types'
import { SlideShell, SlideItem } from '../SlideShell'
import { formatarMoeda } from '../formato'

function ListaDisparos({ titulo, itens, cor }: { titulo: string; itens: ResultadosJunho2026['topDisparos']; cor: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold mb-2 text-left" style={{ color: cor }}>
        {titulo}
      </div>
      <div className="flex flex-col gap-2">
        {itens.map((d) => (
          <div
            key={`${d.data}-${d.nome}`}
            className="flex items-center justify-between rounded-lg glass bg-[var(--glass-bg)] border border-[var(--glass-border)] px-3 py-2 text-left gap-2"
          >
            <div className="min-w-0">
              <div className="text-xs font-medium text-[var(--text-primary)] truncate">{d.nome}</div>
              <div className="text-[10px] text-[var(--text-muted)]">{d.data}</div>
            </div>
            <div className="text-xs font-bold shrink-0" style={{ color: cor }}>
              {formatarMoeda(d.lucro)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SlideRanking({ dados }: { dados: ResultadosJunho2026 }) {
  const maxAbs = Math.max(...dados.porDia.map((d) => Math.abs(d.lucro)), 1)

  return (
    <SlideShell eyebrow="Ranking do mês" titulo="Melhores e piores disparos">
      <SlideItem className="w-full flex flex-col md:flex-row gap-6">
        <ListaDisparos titulo="Top 5 lucro" itens={dados.topDisparos} cor="var(--success)" />
        <ListaDisparos titulo="Bottom 5 lucro" itens={dados.bottomDisparos} cor="var(--error)" />
      </SlideItem>

      <SlideItem className="w-full">
        <div className="text-sm font-semibold text-[var(--text-secondary)] mb-2 text-left">
          Lucro por dia — melhor dia: {dados.melhorDia.data} ({formatarMoeda(dados.melhorDia.lucro)})
        </div>
        <div className="flex items-end gap-1 h-24 w-full">
          {dados.porDia.map((d, i) => (
            <motion.div
              key={d.data}
              className="flex-1 rounded-t-sm"
              style={{
                backgroundColor: d.lucro >= 0 ? 'var(--success)' : 'var(--error)',
                opacity: d.data === dados.melhorDia.data ? 1 : 0.55,
              }}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max((Math.abs(d.lucro) / maxAbs) * 100, 4)}%` }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.02, ease: [0.16, 1, 0.3, 1] as const }}
              title={`${d.data}: ${formatarMoeda(d.lucro)}`}
            />
          ))}
        </div>
      </SlideItem>
    </SlideShell>
  )
}
