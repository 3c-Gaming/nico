'use client'

import { Check } from 'lucide-react'
import { Dropdown } from '../ui/Dropdown'
import { LIGAS_ACOMPANHADAS } from '@/lib/jogos'

interface JogosFiltrosProps {
  selecionadas: number[]
  onChange: (ids: number[]) => void
}

export function JogosFiltros({ selecionadas, onChange }: JogosFiltrosProps) {
  return (
    <Dropdown label={`Campeonato${selecionadas.length > 0 ? ` (${selecionadas.length})` : ''}`}>
      <div className="p-1 min-w-[200px]">
        {LIGAS_ACOMPANHADAS.map((liga) => {
          const selected = selecionadas.includes(liga.id)
          return (
            <button
              key={liga.id}
              onClick={() => onChange(selected ? selecionadas.filter((id) => id !== liga.id) : [...selecionadas, liga.id])}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded transition-colors"
            >
              <span className="flex-1 text-left">{liga.nome}</span>
              {selected && <Check size={14} className="text-[var(--d1)]" />}
            </button>
          )
        })}
      </div>
    </Dropdown>
  )
}
