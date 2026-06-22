'use client'

import { useState, useEffect, useCallback } from 'react'
import { getState, addCasaAposta, setState } from '@/lib/store'
import type { CasaAposta } from '@/types'

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
  const [casas, setCasas] = useState<Record<string, CasaAposta>>(() => getState().casasAposta)

  const sync = useCallback(() => {
    setCasas({ ...getState().casasAposta })
  }, [])

  useEffect(() => {
    window.addEventListener('nico:state-changed', sync)
    return () => window.removeEventListener('nico:state-changed', sync)
  }, [sync])

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
    }
    addCasaAposta(casa)
    return casa
  }, [])

  const remove = useCallback((id: string) => {
    const state = getState()
    delete state.casasAposta[id]
    setState(state)
  }, [])

  const list = Object.values(casas)
  const getById = useCallback((id: string) => casas[id] ?? null, [casas])

  return { casas, list, getById, add, remove }
}
