'use client'

interface StatusDotProps {
  status: 'rascunho' | 'pronto' | 'em_validacao' | 'executado' | 'cancelado'
  size?: number
}

const DOT_CORES: Record<string, string> = {
  rascunho: 'var(--text-muted)',
  pronto: 'var(--info)',
  em_validacao: 'var(--warning)',
  executado: 'var(--success)',
  cancelado: 'var(--error)',
}

export function StatusDot({ status, size = 8 }: StatusDotProps) {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: DOT_CORES[status] ?? 'var(--text-muted)',
      }}
    />
  )
}
