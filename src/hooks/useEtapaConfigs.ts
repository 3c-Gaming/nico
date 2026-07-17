'use client'

import { useSyncExternalStore, useCallback } from 'react'
import { getState, setEtapaConfigs } from '@/lib/store'
import type { EsteiraEtapaConfig } from '@/types'

let cachedJson = ''
let cachedList: EsteiraEtapaConfig[] = []

function subscribe(callback: () => void) {
  window.addEventListener('nico:state-changed', callback)
  return () => window.removeEventListener('nico:state-changed', callback)
}

function getSnapshot() {
  const state = getState()
  const json = JSON.stringify(state.etapaConfigs)
  if (json !== cachedJson) {
    cachedJson = json
    cachedList = state.etapaConfigs
  }
  return cachedList
}

function getServerSnapshot(): EsteiraEtapaConfig[] {
  return cachedList
}

export function useEtapaConfigs() {
  const configs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setConfigs = useCallback((novos: EsteiraEtapaConfig[]) => {
    setEtapaConfigs(novos)
  }, [])

  return { configs, setConfigs }
}
