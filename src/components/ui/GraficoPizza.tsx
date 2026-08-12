'use client'

import { motion } from 'framer-motion'

export interface FatiaPizza {
  label: string
  valor: number
  cor: string
}

interface GraficoPizzaProps {
  itens: FatiaPizza[]
  formatarValor?: (v: number) => string
  tamanho?: number
}

export function GraficoPizza({ itens, formatarValor, tamanho = 160 }: GraficoPizzaProps) {
  const total = itens.reduce((acc, i) => acc + i.valor, 0)
  const fmt = formatarValor ?? ((v: number) => String(v))

  const fatias = itens.reduce<(FatiaPizza & { inicio: number; fim: number })[]>((acc, item) => {
    const anterior = acc.at(-1)?.fim ?? 0
    const fim = total > 0 ? anterior + (item.valor / total) * 360 : 0
    acc.push({ ...item, inicio: anterior, fim })
    return acc
  }, [])

  const gradiente = total > 0
    ? `conic-gradient(${fatias.map((f) => `${f.cor} ${f.inicio}deg ${f.fim}deg`).join(', ')})`
    : 'var(--bg-elevated)'

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-full shrink-0"
        style={{ width: tamanho, height: tamanho, background: gradiente }}
      />
      <div className="flex flex-col gap-2 w-full">
        {fatias.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: item.cor }} />
            <span className="text-[var(--text-secondary)] flex-1 truncate">{item.label}</span>
            <span className="font-semibold text-[var(--text-primary)]">{fmt(item.valor)}</span>
            <span className="text-[var(--text-muted)] w-12 text-right">
              {total > 0 ? `${((item.valor / total) * 100).toFixed(1)}%` : '0.0%'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
