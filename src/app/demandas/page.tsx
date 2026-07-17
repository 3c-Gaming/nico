'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSyncExternalStore } from 'react'
import { KanbanBoard } from '@/components/demandas/KanbanBoard'
import { FiltrosDemandaBar, FILTROS_VAZIOS, type FiltrosDemanda } from '@/components/demandas/FiltrosDemanda'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { ClipboardList, Plus } from 'lucide-react'
import { getState, getSnapshot, setState, addDemanda, patchDemandas, deletarDemanda } from '@/lib/store'
import type { AppState, Demanda, UsuarioResponsavel } from '@/types'

function subscribe(cb: () => void) {
  window.addEventListener('nico:state-changed', cb)
  return () => window.removeEventListener('nico:state-changed', cb)
}

function useStore() {
  return useSyncExternalStore(subscribe, () => getSnapshot(), () => getState())
}

export default function DemandasPage() {
  const store = useStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const demandas = Object.values(store.demandas)
  const usuarios = store.usuariosResponsaveis

  const carregarDados = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [demRes, usrRes] = await Promise.all([
        fetch('/api/demandas'),
        fetch('/api/usuarios-responsaveis'),
      ])

      if (demRes.ok) {
        const demData = await demRes.json()
        const demMap: Record<string, Demanda> = {}
        for (const d of demData.demandas as Demanda[]) {
          demMap[d.id] = d
        }
        const state = getState()
        state.demandas = demMap
      }

      if (usrRes.ok) {
        const usrData = await usrRes.json()
        const usrMap: Record<string, UsuarioResponsavel> = {}
        for (const u of usrData.usuarios as UsuarioResponsavel[]) {
          usrMap[u.id] = u
        }
        const state = getState()
        state.usuariosResponsaveis = usrMap
      }

      setState(getState())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregarDados() }, [carregarDados])

  const [creating, setCreating] = useState(false)
  const [filtros, setFiltros] = useState<FiltrosDemanda>(FILTROS_VAZIOS)

  const demandasFiltradas = useMemo(() => {
    return demandas.filter((d) => {
      if (filtros.dataDe && d.criadoEm < filtros.dataDe) return false
      if (filtros.dataAte && d.criadoEm > filtros.dataAte + 'T23:59:59') return false
      if (filtros.responsavelId && d.responsavelId !== filtros.responsavelId) return false
      if (filtros.tag && !d.tags.some((t) => t.toLowerCase().includes(filtros.tag.toLowerCase()))) return false
      if (filtros.titulo && !d.titulo.toLowerCase().includes(filtros.titulo.toLowerCase())) return false
      return true
    })
  }, [demandas, filtros])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        setCreating(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const handleDemandaUpdate = useCallback((demanda: Demanda) => {
    if (getState().demandas[demanda.id]) {
      patchDemandas({ [demanda.id]: demanda })
    } else {
      addDemanda(demanda)
    }
  }, [])

  const handleDemandaDelete = useCallback((id: string) => {
    deletarDemanda(id)
  }, [])

  const handleReorder = useCallback((reordered: Demanda[]) => {
    const updates: { id: string; coluna: string; ordem: number }[] = []
    for (const d of reordered) {
      updates.push({ id: d.id, coluna: d.coluna, ordem: d.ordem })
      const state = getState()
      if (state.demandas[d.id]) {
        state.demandas[d.id].coluna = d.coluna
        state.demandas[d.id].ordem = d.ordem
      }
    }
    setState(getState())
    for (const { id, coluna, ordem } of updates) {
      fetch(`/api/demandas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coluna, ordem }),
      }).catch(() => {})
    }
  }, [])

  return (
    <div className="flex-1 flex flex-col">
      <PageHeader
        titulo="Demandas"
        descricao="Gerencie as demandas de marketing"
        icon={<ClipboardList size={20} />}
        acoes={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} /> Nova
            <span className="ml-1 text-[10px] opacity-60 font-mono">Ctrl+N</span>
          </Button>
        }
      />

      <div className="flex-1 p-6">
        {loading && (
          <div className="flex justify-center py-12">
            <Spinner size={24} />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-12">
            <div className="px-4 py-3 rounded-md text-sm" style={{ backgroundColor: 'var(--error)15', border: '1px solid var(--error)30', color: 'var(--error)' }}>
              {error}
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <FiltrosDemandaBar
              filtros={filtros}
              onChange={(f) => setFiltros((prev) => ({ ...prev, ...f }))}
              usuarios={usuarios}
              total={demandas.length}
              totalFiltrado={demandasFiltradas.length}
            />
            <KanbanBoard
              demandas={demandasFiltradas}
              usuarios={usuarios}
              onDemandaUpdate={handleDemandaUpdate}
              onDemandaDelete={handleDemandaDelete}
              onReorder={handleReorder}
            />
          </>
        )}
      </div>
    </div>
  )
}
