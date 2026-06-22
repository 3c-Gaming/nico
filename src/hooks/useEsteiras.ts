'use client'

import { useState, useEffect, useCallback } from 'react'
import { getState, patchEsteiras, setState } from '@/lib/store'
import type { Esteira } from '@/types'

export function useEsteiras() {
  const [esteiras, setEsteiras] = useState<Record<string, Esteira>>(() => getState().esteiras)

  const sync = useCallback(() => {
    setEsteiras({ ...getState().esteiras })
  }, [])

  useEffect(() => {
    window.addEventListener('nico:state-changed', sync)
    return () => window.removeEventListener('nico:state-changed', sync)
  }, [sync])

  const update = useCallback((id: string, data: Partial<Esteira>) => {
    patchEsteiras({ [id]: data as Esteira })
  }, [])

  const create = useCallback((esteira: Esteira) => {
    const state = getState()
    state.esteiras[esteira.id] = esteira
    setState(state)
  }, [])

  const list = Object.values(esteiras).filter((e) => e.ativa)
  const getById = useCallback((id: string) => esteiras[id] ?? null, [esteiras])

  return { esteiras, list, getById, update, create }
}
