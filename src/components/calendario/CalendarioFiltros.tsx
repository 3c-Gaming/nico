'use client'

import { Dropdown } from '../ui/Dropdown'
import type { FiltrosCalendario } from './useCalendario'
import type { TipoDisparo, StatusDisparo } from '@/types'
import { useCasasAposta } from '@/hooks/useCasasAposta'
import { Check } from 'lucide-react'

interface CalendarioFiltrosProps {
  filtros: FiltrosCalendario
  onChange: (f: Partial<FiltrosCalendario>) => void
}

const TIPOS: TipoDisparo[] = ['D1', 'D3', 'D5', 'D7', 'PONTUAL']
const STATUS: StatusDisparo[] = ['rascunho', 'pronto', 'em_validacao', 'executado', 'cancelado']

export function CalendarioFiltros({ filtros, onChange }: CalendarioFiltrosProps) {
  const { list: casas } = useCasasAposta()

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Dropdown label={`Casa${filtros.casas.length > 0 ? ` (${filtros.casas.length})` : ''}`}>
        <div className="p-2 max-h-48 overflow-y-auto">
          {casas.map((casa) => {
            const selected = filtros.casas.includes(casa.id)
            return (
              <button
                key={casa.id}
                onClick={() => {
                  const next = selected
                    ? filtros.casas.filter((id) => id !== casa.id)
                    : [...filtros.casas, casa.id]
                  onChange({ casas: next })
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded transition-colors"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: casa.cor }}
                />
                <span className="flex-1 text-left">{casa.nome}</span>
                {selected && <Check size={14} className="text-[var(--d1)]" />}
              </button>
            )
          })}
        </div>
      </Dropdown>

      <Dropdown label={`Tipo${filtros.tipos.length > 0 ? ` (${filtros.tipos.length})` : ''}`}>
        <div className="p-2">
          {TIPOS.map((tipo) => {
            const selected = filtros.tipos.includes(tipo)
            return (
              <button
                key={tipo}
                onClick={() => {
                  const next = selected
                    ? filtros.tipos.filter((t) => t !== tipo)
                    : [...filtros.tipos, tipo]
                  onChange({ tipos: next })
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded transition-colors"
              >
                <span className="flex-1 text-left">{tipo}</span>
                {selected && <Check size={14} className="text-[var(--d1)]" />}
              </button>
            )
          })}
        </div>
      </Dropdown>

      <Dropdown label={`Status${filtros.status.length > 0 ? ` (${filtros.status.length})` : ''}`}>
        <div className="p-2">
          {STATUS.map((st) => {
            const selected = filtros.status.includes(st)
            return (
              <button
                key={st}
                onClick={() => {
                  const next = selected
                    ? filtros.status.filter((s) => s !== st)
                    : [...filtros.status, st]
                  onChange({ status: next })
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded transition-colors"
              >
                <span className="flex-1 text-left capitalize">{st.replace('_', ' ')}</span>
                {selected && <Check size={14} className="text-[var(--d1)]" />}
              </button>
            )
          })}
        </div>
      </Dropdown>

      <label className="flex items-center gap-1.5 h-8 px-2.5 text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border)] rounded cursor-pointer hover:text-[var(--text-primary)] transition-colors">
        <input
          type="checkbox"
          checked={filtros.apenasEsteiras}
          onChange={(e) => onChange({ apenasEsteiras: e.target.checked })}
          className="accent-[var(--d1)]"
        />
        Apenas esteiras
      </label>
    </div>
  )
}
