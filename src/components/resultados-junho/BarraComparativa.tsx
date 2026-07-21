'use client'

import { motion } from 'framer-motion'

export interface ItemBarra {
  label: string
  valor: number
  cor: string
  destaque?: string
}

interface BarraComparativaProps {
  itens: ItemBarra[]
  ativo?: boolean
  formatarValor?: (v: number) => string
  alturaBarra?: number
}

export function BarraComparativa({ itens, ativo = true, formatarValor, alturaBarra = 36 }: BarraComparativaProps) {
  const max = Math.max(...itens.map((i) => i.valor), 1)

  return (
    <div className="flex flex-col gap-3 w-full">
      {itens.map((item, i) => (
        <div key={item.label} className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 sm:w-24 shrink-0 text-sm font-medium text-[var(--text-secondary)]">{item.label}</div>
          <div
            className="flex-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden"
            style={{ height: `clamp(18px, 5vw, ${alturaBarra}px)` }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: item.cor }}
              initial={{ width: 0 }}
              animate={{ width: ativo ? `${Math.max((item.valor / max) * 100, 2)}%` : 0 }}
              transition={{ duration: 1, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] as const }}
            />
          </div>
          <div className="w-16 sm:w-28 shrink-0 text-xs sm:text-sm font-bold text-right" style={{ color: item.cor }}>
            {item.destaque ?? (formatarValor ? formatarValor(item.valor) : item.valor)}
          </div>
        </div>
      ))}
    </div>
  )
}
