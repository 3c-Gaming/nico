'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import type { FiltrosCopaCalendario } from '@/hooks/useCopaCalendario'

interface CopaFiltrosProps {
  filtros: FiltrosCopaCalendario
  onChange: (f: Partial<FiltrosCopaCalendario>) => void
  stages: string[]
  grupos: string[]
}

function DropdownMulti<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: T[]
  selected: T[]
  onChange: (vals: T[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const display = selected.length === 0
    ? label
    : `${label} (${selected.length})`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 h-8 px-3 text-xs rounded border transition-colors ${
          selected.length > 0
            ? 'border-[var(--d1)] text-[var(--d1)] bg-[var(--d1)]/10'
            : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
        }`}
      >
        {display}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 min-w-[180px] bg-[var(--bg-surface)] border border-[var(--border)] rounded shadow-lg p-1.5 space-y-0.5">
          {options.map((opt) => {
            const ativo = selected.includes(opt)
            return (
              <button
                key={opt}
                onClick={() => {
                  onChange(ativo ? selected.filter((s) => s !== opt) : [...selected, opt])
                }}
                className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                  ativo
                    ? 'bg-[var(--d1)]/10 text-[var(--d1)] font-medium'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                {opt || '(sem grupo)'}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CopaFiltros({ filtros, onChange, stages, grupos }: CopaFiltrosProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <DropdownMulti
        label="Estágio"
        options={stages}
        selected={filtros.stages}
        onChange={(vals) => onChange({ stages: vals })}
      />
      <DropdownMulti
        label="Grupo"
        options={grupos}
        selected={filtros.grupos}
        onChange={(vals) => onChange({ grupos: vals })}
      />
    </div>
  )
}
