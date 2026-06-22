'use client'

import type { CasaAposta, TipoDisparo } from '@/types'
import { gerarNomenclatura } from '@/lib/nomenclatura'

interface PreviewNomenclaturaProps {
  dataCriacao: Date
  tipoDisparo: TipoDisparo
  dataDisparo: Date
  casas: CasaAposta[]
  value?: string
  onChange?: (value: string) => void
  editavel?: boolean
}

export function PreviewNomenclatura({
  dataCriacao,
  tipoDisparo,
  dataDisparo,
  casas,
  value,
  onChange,
  editavel = true,
}: PreviewNomenclaturaProps) {
  const gerada = gerarNomenclatura({ dataCriacao, tipoDisparo, dataDisparo, casas })
  const exibida = value ?? gerada

  return (
    <div className="space-y-1">
      <span className="text-xs text-[var(--text-muted)]">Nomenclatura</span>
      <input
        type="text"
        value={exibida}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={!editavel}
        className="w-full px-3 py-2 text-sm font-mono bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)] read-only:opacity-70 read-only:cursor-default"
      />
      {value && value !== gerada && (
        <p className="text-xs text-[var(--warning)]">Customizado (nomenclatura automática: {gerada})</p>
      )}
    </div>
  )
}
