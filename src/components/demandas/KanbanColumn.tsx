'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanCard } from './KanbanCard'
import type { Demanda, UsuarioResponsavel, ColunaDemanda } from '@/types'

const COLUNA_TITULO: Record<ColunaDemanda, string> = {
  ideias: 'Na Fila',
  fazendo: 'Fazendo',
  revisao: 'Revisão',
  concluido: 'Concluído',
}

interface KanbanColumnProps {
  coluna: ColunaDemanda
  demandas: Demanda[]
  usuarios: Record<string, UsuarioResponsavel>
  onCardClick: (id: string) => void
}

export function KanbanColumn({ coluna, demandas, usuarios, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna })

  return (
    <div
      className="flex flex-col min-w-[280px] w-[280px] flex-shrink-0 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]"
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{COLUNA_TITULO[coluna]}</h2>
        <span className="text-xs text-[var(--text-muted)] font-mono bg-[var(--bg-elevated)] px-2 py-0.5 rounded">
          {demandas.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px] max-h-[calc(100vh-200px)] transition-colors ${isOver ? 'bg-[var(--bg-elevated)]/50' : ''}`}
      >
        <SortableContext items={demandas.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {demandas.map((demanda) => (
            <KanbanCard
              key={demanda.id}
              demanda={demanda}
              usuario={demanda.responsavelId ? usuarios[demanda.responsavelId] : undefined}
              onClick={() => onCardClick(demanda.id)}
            />
          ))}
        </SortableContext>

        {demandas.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-[var(--text-muted)]">
            Arraste uma demanda aqui
          </div>
        )}
      </div>
    </div>
  )
}
