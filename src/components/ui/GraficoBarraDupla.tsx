'use client'

import { motion } from 'framer-motion'

export interface ItemBarraDupla {
  label: string
  valorA: number
  valorB: number
}

interface GraficoBarraDuplaProps {
  itens: ItemBarraDupla[]
  nomeA: string
  nomeB: string
  corA?: string
  corB?: string
  formatarValor?: (v: number) => string
  alturaBarra?: number
}

export function GraficoBarraDupla({
  itens,
  nomeA,
  nomeB,
  corA = 'var(--d1)',
  corB = 'var(--pontual)',
  formatarValor,
  alturaBarra = 14,
}: GraficoBarraDuplaProps) {
  const max = Math.max(...itens.flatMap((i) => [i.valorA, i.valorB]), 1)
  const fmt = formatarValor ?? ((v: number) => String(v))

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px] rounded" style={{ backgroundColor: corA }} />
          {nomeA}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-[2px] rounded" style={{ backgroundColor: corB }} />
          {nomeB}
        </span>
      </div>

      {itens.map((item) => (
        <div key={item.label} className="flex flex-col gap-1">
          <div className="text-xs font-medium text-[var(--text-secondary)]">{item.label}</div>
          {([{ valor: item.valorA, cor: corA }, { valor: item.valorB, cor: corB }] as const).map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="flex-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden"
                style={{ height: alturaBarra }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: s.cor }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max((s.valor / max) * 100, 2)}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <div className="w-20 shrink-0 text-xs font-bold text-right font-mono" style={{ color: s.cor }}>
                {fmt(s.valor)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
