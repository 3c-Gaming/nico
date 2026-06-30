'use client'

import { useSyncExternalStore, useCallback, useMemo } from 'react'
import { getState, addCasaAposta, updateCasaAposta, setState } from '@/lib/store'
import type { CasaAposta } from '@/types'

let cachedJson = ''
let cachedCasas: Record<string, CasaAposta> = {}

function subscribe(callback: () => void) {
  window.addEventListener('nico:state-changed', callback)
  return () => window.removeEventListener('nico:state-changed', callback)
}

function getSnapshot() {
  const state = getState()
  const json = JSON.stringify(state.casasAposta)
  if (json !== cachedJson) {
    cachedJson = json
    cachedCasas = JSON.parse(json)
  }
  return cachedCasas
}

const SNAPSHOT_VAZIO: Record<string, CasaAposta> = {}

function getServerSnapshot() {
  return SNAPSHOT_VAZIO
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return hash
}

export function gerarCor(nome: string): string {
  return `hsl(${Math.abs(hashCode(nome)) % 360}, 65%, 55%)`
}

export function slugify(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function useCasasAposta() {
  const casas = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const add = useCallback((nome: string): CasaAposta => {
    const state = getState()
    const existing = Object.values(state.casasAposta).find(
      (c) => c.nome.toLowerCase() === nome.toLowerCase()
    )
    if (existing) return existing

    const casa: CasaAposta = {
      id: crypto.randomUUID(),
      nome,
      slug: slugify(nome),
      cor: gerarCor(nome),
      variaveis: {},
      paineisCPA: [],
      funilIds: [],
    }
    addCasaAposta(casa)
    return casa
  }, [])

  const update = useCallback((id: string, data: Partial<CasaAposta>) => {
    updateCasaAposta(id, data)
  }, [])

  const remove = useCallback((id: string) => {
    const state = getState()
    delete state.casasAposta[id]
    setState(state)
  }, [])

  const uploadLogo = useCallback(async (file: File, slug: string): Promise<string> => {
    const body = new FormData()
    body.append('file', file)
    body.append('slug', slug)
    const res = await fetch('/api/casas/upload-logo', { method: 'POST', body })
    if (!res.ok) throw new Error((await res.json()).error || 'Erro ao fazer upload')
    const { logo } = await res.json()
    return logo
  }, [])

  const removeLogo = useCallback(async (slug: string) => {
    await fetch('/api/casas/upload-logo', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    })
  }, [])

  const list = Object.values(casas)
  const getById = useCallback((id: string) => casas[id] ?? null, [casas])

  const allFunilNames = useMemo(() => {
    const names = new Set<string>()
    for (const cfg of Object.values(getState().flowTagConfigs)) {
      if (cfg.funil) names.add(cfg.funil)
    }
    return [...names].sort()
  }, [JSON.stringify(getState().flowTagConfigs)])

  return { casas, list, getById, add, update, remove, allFunilNames, uploadLogo, removeLogo }
}
