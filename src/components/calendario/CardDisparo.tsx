'use client'

import { useState } from 'react'
import type { Disparo } from '@/types'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { Badge } from '../ui/Badge'
import { Chip } from '../ui/Chip'
import { StatusDot } from '../ui/StatusDot'
import { Modal } from '../ui/Modal'

const TIPO_CORES: Record<string, string> = {
  D1: 'var(--d1)',
  D3: 'var(--d3)',
  D5: 'var(--d5)',
  D7: 'var(--d7)',
  PONTUAL: 'var(--pontual)',
}

interface CardDisparoProps {
  disparo: Disparo
}

export function CardDisparo({ disparo }: CardDisparoProps) {
  const [open, setOpen] = useState(false)
  const { casas } = useCasasAposta()

  const cor = TIPO_CORES[disparo.tipo] ?? 'var(--text-secondary)'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left rounded p-2.5 transition-all duration-150 group"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${cor}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'
          e.currentTarget.style.borderColor = 'var(--border-strong)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
          e.currentTarget.style.borderColor = 'var(--border)'
        }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold" style={{ color: cor }}>
            {disparo.tipo}
          </span>
        </div>

        <div className="flex flex-wrap gap-1 mb-1">
          {disparo.casasAposta.map((casaId) => {
            const casa = casas[casaId]
            if (!casa) return null
            return <Chip key={casaId} label={casa.nome} cor={casa.cor} size="sm" />
          })}
        </div>

        <p className="font-mono text-[11px] text-[var(--text-secondary)] truncate mb-1">
          {disparo.nomenclatura}
        </p>

        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <span>{disparo.horarioDisparo}</span>
          <span>·</span>
          <StatusDot status={disparo.status} size={6} />
          <span className="capitalize">{disparo.status.replace('_', ' ')}</span>
        </div>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={disparo.nomenclatura}>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[var(--text-muted)] block text-xs">Tipo</span>
              <Badge variant="tipo" value={disparo.tipo} />
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-xs">Status</span>
              <Badge variant="status" value={disparo.status} />
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-xs">Data</span>
              <span className="text-[var(--text-primary)]">{disparo.dataDisparo}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-xs">Horário</span>
              <span className="text-[var(--text-primary)]">{disparo.horarioDisparo}</span>
            </div>
          </div>

          <div>
            <span className="text-[var(--text-muted)] block text-xs mb-1">Casas de Aposta</span>
            <div className="flex flex-wrap gap-1">
              {disparo.casasAposta.map((casaId) => {
                const casa = casas[casaId]
                if (!casa) return null
                return <Chip key={casaId} label={casa.nome} cor={casa.cor} size="md" />
              })}
            </div>
          </div>

          <div>
            <span className="text-[var(--text-muted)] block text-xs mb-1">Base CSV</span>
            <span className="text-[var(--text-primary)]">{disparo.base.status}</span>
            {disparo.base.nomeArquivo && (
              <span className="text-[var(--text-secondary)] ml-2">({disparo.base.nomeArquivo})</span>
            )}
          </div>

          {disparo.notas && (
            <div>
              <span className="text-[var(--text-muted)] block text-xs mb-1">Notas</span>
              <p className="text-[var(--text-primary)]">{disparo.notas}</p>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
