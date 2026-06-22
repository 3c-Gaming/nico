'use client'

import { useState, useEffect, useCallback } from 'react'
import { getState, patchDisparos, deletarDisparo, setState } from '@/lib/store'
import type { Disparo } from '@/types'

export function useDisparos() {
  const [disparos, setDisparos] = useState<Record<string, Disparo>>({})
  const [loading, setLoading] = useState(true)

  const sync = useCallback(() => {
    setDisparos({ ...getState().disparos })
    setLoading(false)
  }, [])

  useEffect(() => {
    sync()
    window.addEventListener('nico:state-changed', sync)
    return () => window.removeEventListener('nico:state-changed', sync)
  }, [sync])

  const update = useCallback((id: string, data: Partial<Disparo>) => {
    patchDisparos({ [id]: data as Disparo })
  }, [])

  const remove = useCallback((id: string) => {
    deletarDisparo(id)
  }, [])

  const create = useCallback((disparo: Disparo) => {
    const state = getState()
    state.disparos[disparo.id] = disparo
    setState(state)
  }, [])

  const list = Object.values(disparos)
  const getById = useCallback((id: string) => disparos[id] ?? null, [disparos])

  return { disparos, list, getById, update, remove, create, loading }
}
