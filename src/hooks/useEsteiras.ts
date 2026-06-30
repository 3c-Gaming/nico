'use client'

import { useSyncExternalStore, useCallback } from 'react'
import { getState, patchEsteiras, setState } from '@/lib/store'
import type { Esteira } from '@/types'

let cachedJson = ''
let cachedEsteiras: Record<string, Esteira> = {}

function subscribe(callback: () => void) {
  window.addEventListener('nico:state-changed', callback)
  return () => window.removeEventListener('nico:state-changed', callback)
}

function getSnapshot() {
  const state = getState()
  const json = JSON.stringify(state.esteiras)
  if (json !== cachedJson) {
    cachedJson = json
    cachedEsteiras = JSON.parse(json)
  }
  return cachedEsteiras
}

const SNAPSHOT_VAZIO: Record<string, Esteira> = {}

function getServerSnapshot() {
  return SNAPSHOT_VAZIO
}

export function useEsteiras() {
  const esteiras = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

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
