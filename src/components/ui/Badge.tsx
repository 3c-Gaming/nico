'use client'

import type { TipoDisparo, StatusDisparo } from '@/types'

interface BadgeProps {
  variant?: 'tipo' | 'status'
  value: TipoDisparo | StatusDisparo | string
}

const TIPO_CORES: Record<string, string> = {
  D1: 'var(--d1)',
  D3: 'var(--d3)',
  D5: 'var(--d5)',
  D7: 'var(--d7)',
  PONTUAL: 'var(--pontual)',
}

const STATUS_CORES: Record<string, string> = {
  rascunho: 'var(--text-muted)',
  pronto: 'var(--info)',
  em_validacao: 'var(--warning)',
  executado: 'var(--success)',
  cancelado: 'var(--error)',
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  pronto: 'Pronto',
  em_validacao: 'Validando',
  executado: 'Executado',
  cancelado: 'Cancelado',
}

export function Badge({ variant = 'status', value }: BadgeProps) {
  const cor = variant === 'tipo'
    ? TIPO_CORES[value] ?? 'var(--text-secondary)'
    : STATUS_CORES[value] ?? 'var(--text-secondary)'
  const label = variant === 'status'
    ? STATUS_LABELS[value] ?? value
    : value

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{
        backgroundColor: `${cor}18`,
        color: cor,
        border: `1px solid ${cor}30`,
      }}
    >
      {variant === 'tipo' && '■ '}
      {label}
    </span>
  )
}
