'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { ModalDemanda } from './ModalDemanda'
import type { Demanda, ColunaDemanda, UsuarioResponsavel } from '@/types'

const COLUNAS: ColunaDemanda[] = ['ideias', 'fazendo', 'revisao', 'concluido']

interface KanbanBoardProps {
  demandas: Demanda[]
  usuarios: Record<string, UsuarioResponsavel>
  onDemandaUpdate: (demanda: Demanda) => void
  onDemandaDelete: (id: string) => void
  onReorder: (demandas: Demanda[]) => void
}

export function KanbanBoard({ demandas, usuarios, onDemandaUpdate, onDemandaDelete, onReorder }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const demandasPorColuna = COLUNAS.reduce(
    (acc, coluna) => {
      acc[coluna] = demandas.filter((d) => d.coluna === coluna)
      return acc
    },
    {} as Record<ColunaDemanda, Demanda[]>
  )

  const activeDemanda = activeId ? demandas.find((d) => d.id === activeId) : null

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = event
      if (!over) return

      const activeDemanda = demandas.find((d) => d.id === active.id)
      if (!activeDemanda) return

      const overId = over.id as string
      const isOverColumn = COLUNAS.includes(overId as ColunaDemanda)
      const sourceColuna = activeDemanda.coluna

      if (isOverColumn) {
        const targetColuna = overId as ColunaDemanda
        const targetDemandas = demandasPorColuna[targetColuna]
        const novaOrdem = targetDemandas.length > 0
          ? Math.max(...targetDemandas.map((d) => d.ordem)) + 1
          : 0

        const updated = { ...activeDemanda, coluna: targetColuna, ordem: novaOrdem }
        onDemandaUpdate(updated)
        return
      }

      const overDemanda = demandas.find((d) => d.id === overId)
      if (!overDemanda) return

      const targetColuna = overDemanda.coluna
      const colunaDemandas = demandasPorColuna[targetColuna]
      const oldIdx = colunaDemandas.findIndex((d) => d.id === active.id)
      const newIdx = colunaDemandas.findIndex((d) => d.id === over.id)
      if (oldIdx === -1 && newIdx === -1) return

      const reordered = arrayMove(
        colunaDemandas,
        oldIdx >= 0 ? oldIdx : colunaDemandas.length,
        newIdx
      )
      reordered.forEach((d, i) => { d.ordem = i })
      if (activeDemanda.coluna !== targetColuna) {
        reordered.forEach((d) => { if (d.id === activeDemanda.id) d.coluna = targetColuna })
      }

      // se o card mudou de coluna, reindexar a coluna de origem
      const allAffected = [...reordered]
      if (sourceColuna !== targetColuna) {
        const sourceDemandas = demandasPorColuna[sourceColuna].filter((d) => d.id !== active.id)
        sourceDemandas.forEach((d, i) => { d.ordem = i })
        allAffected.push(...sourceDemandas)
      }

      onReorder(allAffected)
    },
    [demandas, demandasPorColuna, onDemandaUpdate, onReorder]
  )

  const editingDemanda = editingId ? demandas.find((d) => d.id === editingId) ?? null : null

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {COLUNAS.map((coluna) => (
            <KanbanColumn
              key={coluna}
              coluna={coluna}
              demandas={demandasPorColuna[coluna]}
              usuarios={usuarios}
              onCardClick={(id) => setEditingId(id)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDemanda && (
            <div className="w-[280px] opacity-90">
              <KanbanCard
                demanda={activeDemanda}
                usuario={activeDemanda.responsavelId ? usuarios[activeDemanda.responsavelId] : undefined}
                onClick={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <ModalDemanda
        open={creating}
        onClose={() => setCreating(false)}
        onSave={(d) => { onDemandaUpdate(d); setCreating(false) }}
        usuarios={usuarios}
      />

      <ModalDemanda
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        demanda={editingDemanda}
        onSave={(d) => { onDemandaUpdate(d); setEditingId(null) }}
        onDelete={(id) => { onDemandaDelete(id); setEditingId(null) }}
        usuarios={usuarios}
      />

      {!creating && !editingId && (
        <button
          onClick={() => setCreating(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-white shadow-lg hover:brightness-110 transition-all"
          style={{ backgroundColor: 'var(--d1)' }}
        >
          + Nova Demanda
        </button>
      )}
    </>
  )
}
