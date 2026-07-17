'use client'

import { useSyncExternalStore, useCallback } from 'react'
import { getState } from '@/lib/store'
import { addUtmConfig, updateUtmConfig, deletarUtmConfig } from '@/lib/store'
import type { UtmConfig } from '@/types'

let cachedJson = ''
let cachedList: UtmConfig[] = []

function subscribe(callback: () => void) {
  window.addEventListener('nico:state-changed', callback)
  return () => window.removeEventListener('nico:state-changed', callback)
}

function getSnapshot() {
  const state = getState()
  const json = JSON.stringify(state.utmConfigs)
  if (json !== cachedJson) {
    cachedJson = json
    cachedList = Object.values(state.utmConfigs)
  }
  return cachedList
}

function getServerSnapshot(): UtmConfig[] {
  return []
}

export function useUtmConfigs() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const add = useCallback((data: { nome: string; valor: string; casa: 'superbet' | 'betmgm' }) => {
    const config: UtmConfig = {
      id: crypto.randomUUID(),
      nome: data.nome,
      valor: data.valor,
      casa: data.casa,
      criadoEm: new Date().toISOString(),
    }
    addUtmConfig(config)
    return config
  }, [])

  const update = useCallback((id: string, data: Partial<UtmConfig>) => {
    updateUtmConfig(id, data)
  }, [])

  const remove = useCallback((id: string) => {
    deletarUtmConfig(id)
  }, [])

  return { list, add, update, remove }
}
