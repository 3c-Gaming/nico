'use client'

import { useSyncExternalStore, useCallback } from 'react'
import { getState, patchDisparos, deletarDisparo, setState } from '@/lib/store'
import type { Disparo } from '@/types'

let cachedJson = ''
let cachedDisparos: Record<string, Disparo> = {}

function subscribe(callback: () => void) {
  window.addEventListener('nico:state-changed', callback)
  return () => window.removeEventListener('nico:state-changed', callback)
}

function getSnapshot() {
  const state = getState()
  const json = JSON.stringify(state.disparos)
  if (json !== cachedJson) {
    cachedJson = json
    cachedDisparos = JSON.parse(json)
  }
  return cachedDisparos
}

const SNAPSHOT_VAZIO: Record<string, Disparo> = {}

function getServerSnapshot() {
  return SNAPSHOT_VAZIO
}

export function useDisparos() {
  const disparos = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

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

  return { disparos, list, getById, update, remove, create }
}
