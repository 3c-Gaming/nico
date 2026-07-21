'use client'

import { StatNumber } from './StatNumber'
import { itemVariants } from './SlideShell'
import { motion } from 'framer-motion'

interface StatTileProps {
  label: string
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  cor?: string
  tamanho?: 'sm' | 'lg'
  delay?: number
}

export function StatTile({ label, value, prefix, suffix, decimals, cor, tamanho = 'sm', delay = 0 }: StatTileProps) {
  const tamanhoTexto = tamanho === 'lg' ? 'text-3xl md:text-5xl' : 'text-xl md:text-2xl'
  return (
    <motion.div
      variants={itemVariants}
      className="rounded-xl glass bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 md:p-5 text-center flex flex-col items-center gap-1"
    >
      <StatNumber
        value={value}
        prefix={prefix}
        suffix={suffix}
        decimals={decimals}
        delay={delay}
        className={`${tamanhoTexto} font-bold`}
        style={cor ? { color: cor } : undefined}
      />
      <div className="text-xs md:text-sm text-[var(--text-muted)] uppercase tracking-wide">{label}</div>
    </motion.div>
  )
}
