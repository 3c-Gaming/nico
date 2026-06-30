'use client'

import { useSyncExternalStore, useCallback } from 'react'
import { getState, addLinkTemplate, updateLinkTemplate, deletarLinkTemplate } from '@/lib/store'
import type { LinkTemplate, TipoDisparo } from '@/types'

let cachedJson = ''
let cachedTemplates: Record<string, LinkTemplate> = {}

function subscribe(callback: () => void) {
  window.addEventListener('nico:state-changed', callback)
  return () => window.removeEventListener('nico:state-changed', callback)
}

function getSnapshot() {
  const state = getState()
  const json = JSON.stringify(state.linkTemplates)
  if (json !== cachedJson) {
    cachedJson = json ?? ''
    cachedTemplates = json ? JSON.parse(json) : {}
  }
  return cachedTemplates
}

const SNAPSHOT_VAZIO: Record<string, LinkTemplate> = {}

function getServerSnapshot() {
  return SNAPSHOT_VAZIO
}

export function renderLinkTemplate(
  urlTemplate: string,
  variaveis: Record<string, string>
): string {
  let url = urlTemplate
  for (const [chave, valor] of Object.entries(variaveis ?? {})) {
    url = url.replace(new RegExp(`\\{\\{${chave}\\}\\}`, 'g'), valor)
  }
  return url
}

export function useLinkTemplates() {
  const templates = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const add = useCallback((template: LinkTemplate) => {
    addLinkTemplate(template)
    return template
  }, [])

  const update = useCallback((id: string, data: Partial<LinkTemplate>) => {
    updateLinkTemplate(id, data)
  }, [])

  const remove = useCallback((id: string) => {
    deletarLinkTemplate(id)
  }, [])

  const list = Object.values(templates)
  const getById = useCallback((id: string) => templates[id] ?? null, [templates])
  const getByCasa = useCallback(
    (casaId: string) => list.filter((t) => t.casaId === casaId),
    [list]
  )
  const getByCasaAndTipo = useCallback(
    (casaId: string, tipo: string) =>
      list.filter((t) => t.casaId === casaId && t.tipos.includes(tipo as TipoDisparo)),
    [list]
  )

  return { templates, list, getById, getByCasa, getByCasaAndTipo, add, update, remove }
}
