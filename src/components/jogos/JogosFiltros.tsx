'use client'

import { LIGAS_ACOMPANHADAS } from '@/lib/jogos'

interface JogosFiltrosProps {
  selecionadas: number[]
  onChange: (ids: number[]) => void
}

export function JogosFiltros({ selecionadas, onChange }: JogosFiltrosProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {LIGAS_ACOMPANHADAS.map((liga) => {
        const ativo = selecionadas.includes(liga.id)
        return (
          <button
            key={liga.id}
            onClick={() => onChange(ativo ? selecionadas.filter((id) => id !== liga.id) : [...selecionadas, liga.id])}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors whitespace-nowrap ${
              ativo
                ? 'bg-[var(--d1)] text-white border-[var(--d1)]'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
            }`}
          >
            {liga.nome}
          </button>
        )
      })}
    </div>
  )
}
