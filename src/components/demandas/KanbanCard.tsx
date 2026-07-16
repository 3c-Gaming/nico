'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { Demanda, UsuarioResponsavel } from '@/types'

const PRIORIDADE_COR: Record<string, string> = {
  baixa: '#6b7280',
  media: '#3b82f6',
  alta: '#f59e0b',
  urgente: '#ef4444',
}

const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}

interface KanbanCardProps {
  demanda: Demanda
  usuario?: UsuarioResponsavel
  onClick: () => void
}

export function KanbanCard({ demanda, usuario, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: demanda.id,
    data: { coluna: demanda.coluna },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const userStories = demanda.userStories ?? []
  const tags = demanda.tags ?? []
  const links = demanda.links ?? []
  const imagens = demanda.imagens ?? []
  const funilIds = demanda.funilIds ?? []
  const userStoriesTotal = userStories.length
  const userStoriesConcluidas = userStories.filter((s) => s.concluido).length

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="glass bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-md cursor-pointer hover:border-[var(--border-strong)] transition-all active:cursor-grabbing"
      onClick={onClick}
    >
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-1">
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] touch-none cursor-grab"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1 mb-1.5">
              {demanda.prioridade && demanda.prioridade !== 'media' && (
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                  style={{ backgroundColor: PRIORIDADE_COR[demanda.prioridade] ?? '#6b7280' }}
                >
                  {PRIORIDADE_LABEL[demanda.prioridade] ?? demanda.prioridade}
                </span>
              )}
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)]"
                >
                  {tag}
                </span>
              ))}
            </div>
            <h3 className="text-sm font-medium text-[var(--text-primary)] leading-tight">{demanda.titulo}</h3>
            {demanda.descricao && (
              <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{demanda.descricao}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1 text-[11px] text-[var(--text-muted)]">
          {usuario && (
            <span className="flex items-center gap-1" title={usuario.nome}>
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-semibold text-white"
                style={{ backgroundColor: usuario.avatar ?? '#6366f1' }}
              >
                {usuario.nome.charAt(0).toUpperCase()}
              </span>
              <span className="truncate max-w-[80px]">{usuario.nome}</span>
            </span>
          )}
          {demanda.dataCriacao && (
            <span>{new Date(demanda.dataCriacao).toLocaleDateString('pt-BR')}</span>
          )}
          {userStoriesTotal > 0 && (
            <span>
              {userStoriesConcluidas}/{userStoriesTotal}
            </span>
          )}
          {links.length > 0 && <span>🔗 {links.length}</span>}
          {imagens.length > 0 && <span>🖼 {imagens.length}</span>}
          {funilIds.length > 0 && <span>🔵 {funilIds.length}</span>}
        </div>
      </div>
    </div>
  )
}
