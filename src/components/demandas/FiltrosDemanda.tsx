'use client'

import { Search, Calendar, X } from 'lucide-react'
import type { UsuarioResponsavel } from '@/types'

export interface FiltrosDemanda {
  dataDe: string
  dataAte: string
  responsavelId: string
  tag: string
  titulo: string
}

export const FILTROS_VAZIOS: FiltrosDemanda = {
  dataDe: '',
  dataAte: '',
  responsavelId: '',
  tag: '',
  titulo: '',
}

interface FiltrosDemandaBarProps {
  filtros: FiltrosDemanda
  onChange: (f: Partial<FiltrosDemanda>) => void
  usuarios: Record<string, UsuarioResponsavel>
  total: number
  totalFiltrado: number
}

export function FiltrosDemandaBar({ filtros, onChange, usuarios, total, totalFiltrado }: FiltrosDemandaBarProps) {
  const temFiltro = filtros.dataDe || filtros.dataAte || filtros.responsavelId || filtros.tag || filtros.titulo
  const usuariosList = Object.values(usuarios).sort((a, b) => a.nome.localeCompare(b.nome))

  return (
    <div className="flex items-center gap-3 flex-wrap mb-4 px-1">
      <div className="relative">
        <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="date"
          value={filtros.dataDe}
          onChange={(e) => onChange({ dataDe: e.target.value })}
          className="h-8 pl-8 pr-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors w-[130px]"
          placeholder="De"
        />
      </div>

      <div className="relative">
        <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="date"
          value={filtros.dataAte}
          onChange={(e) => onChange({ dataAte: e.target.value })}
          className="h-8 pl-8 pr-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors w-[130px]"
          placeholder="Até"
        />
      </div>

      <select
        value={filtros.responsavelId}
        onChange={(e) => onChange({ responsavelId: e.target.value })}
        className="h-8 px-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors"
      >
        <option value="">Todos responsáveis</option>
        {usuariosList.map((u) => (
          <option key={u.id} value={u.id}>{u.nome}</option>
        ))}
      </select>

      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          value={filtros.tag}
          onChange={(e) => onChange({ tag: e.target.value })}
          className="h-8 pl-8 pr-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors w-[140px]"
          placeholder="Buscar tag..."
        />
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          value={filtros.titulo}
          onChange={(e) => onChange({ titulo: e.target.value })}
          className="h-8 pl-8 pr-2 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] transition-colors w-[160px]"
          placeholder="Buscar título..."
        />
      </div>

      {temFiltro && (
        <button
          onClick={() => onChange(FILTROS_VAZIOS)}
          className="h-8 px-2 text-xs flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={12} /> Limpar
        </button>
      )}

      <span className="text-xs text-[var(--text-muted)] ml-auto">
        {temFiltro ? `${totalFiltrado} de ${total}` : `${total} demandas`}
      </span>
    </div>
  )
}
