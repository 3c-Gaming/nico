'use client'

import { useSyncExternalStore, useCallback } from 'react'
import { getState, togglePinDisparo } from '@/lib/store'

let cachedJson = ''
let cachedIds: string[] = []

function subscribe(callback: () => void) {
  window.addEventListener('nico:state-changed', callback)
  return () => window.removeEventListener('nico:state-changed', callback)
}

function getSnapshot() {
  const state = getState()
  const json = JSON.stringify(state.pinnedDisparos)
  if (json !== cachedJson) {
    cachedJson = json
    cachedIds = state.pinnedDisparos
  }
  return cachedIds
}

const SNAPSHOT_VAZIO: string[] = []

function getServerSnapshot() {
  return SNAPSHOT_VAZIO
}

export function usePinnedDisparos() {
  const pinnedDisparos = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback((id: string) => togglePinDisparo(id), [])
  const isPinned = useCallback((id: string) => pinnedDisparos.includes(id), [pinnedDisparos])

  return { pinnedDisparos, toggle, isPinned }
}
