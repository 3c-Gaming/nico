import type { Disparo, Esteira } from '@/types'
import {
  listarDisparos as dbListarDisparos,
  getDisparo as dbGetDisparo,
  criarDisparo as dbCriarDisparo,
  atualizarDisparo as dbAtualizarDisparo,
  deletarDisparo as dbDeletarDisparo,
  listarEsteiras as dbListarEsteiras,
  getEsteira as dbGetEsteira,
  criarEsteira as dbCriarEsteira,
  deletarEsteira as dbDeletarEsteira,
} from '@/lib/db/supabase'

declare global {
  var __NICO_STORE__:
    | { disparos: Record<string, Disparo>; esteiras: Record<string, Esteira> }
    | undefined
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''

export function isDbAvailable(): boolean {
  return Boolean(SUPABASE_URL)
}

function getMemStore() {
  if (!globalThis.__NICO_STORE__) {
    globalThis.__NICO_STORE__ = { disparos: {}, esteiras: {} }
  }
  return globalThis.__NICO_STORE__
}

// --- Disparos ---

export async function listarDisparos(filtros?: {
  casa?: string
  tipo?: string
  status?: string
}): Promise<Disparo[]> {
  if (isDbAvailable()) {
    try {
      return await dbListarDisparos(filtros)
    } catch { }
  }
  const store = getMemStore()
  let lista = Object.values(store.disparos)
  if (filtros?.casa) lista = lista.filter((d) => d.casasAposta.includes(filtros.casa!))
  if (filtros?.tipo) lista = lista.filter((d) => d.tipo === filtros.tipo)
  if (filtros?.status) lista = lista.filter((d) => d.status === filtros.status)
  return lista
}

export async function getDisparo(id: string): Promise<Disparo | null> {
  if (isDbAvailable()) {
    try {
      return await dbGetDisparo(id)
    } catch { }
  }
  return getMemStore().disparos[id] ?? null
}

export async function criarDisparo(disparo: Disparo): Promise<Disparo> {
  if (isDbAvailable()) {
    try {
      return await dbCriarDisparo(disparo)
    } catch { }
  }
  getMemStore().disparos[disparo.id] = disparo
  return disparo
}

export async function atualizarDisparo(id: string, updates: Partial<Disparo>): Promise<Disparo | null> {
  if (isDbAvailable()) {
    try {
      return await dbAtualizarDisparo(id, updates)
    } catch { }
  }
  const store = getMemStore()
  if (!store.disparos[id]) return null
  store.disparos[id] = { ...store.disparos[id], ...updates, atualizadoEm: new Date().toISOString() }
  return store.disparos[id]
}

export async function deletarDisparo(id: string): Promise<boolean> {
  if (isDbAvailable()) {
    try {
      return await dbDeletarDisparo(id)
    } catch { }
  }
  const store = getMemStore()
  if (!store.disparos[id]) return false
  for (const esteiraId of Object.keys(store.esteiras)) {
    const e = store.esteiras[esteiraId]
    if (e.disparos.d1 === id || e.disparos.d3 === id || e.disparos.d5 === id || e.disparos.d7 === id) {
      delete store.esteiras[esteiraId]
    }
  }
  delete store.disparos[id]
  return true
}

// --- Esteiras ---

export async function listarEsteiras(): Promise<Esteira[]> {
  if (isDbAvailable()) {
    try {
      return await dbListarEsteiras()
    } catch { }
  }
  return Object.values(getMemStore().esteiras).filter((e) => e.ativa)
}

export async function getEsteira(id: string): Promise<Esteira | null> {
  if (isDbAvailable()) {
    try {
      return await dbGetEsteira(id)
    } catch { }
  }
  return getMemStore().esteiras[id] ?? null
}

export async function criarEsteira(esteira: Esteira): Promise<Esteira> {
  if (isDbAvailable()) {
    try {
      return await dbCriarEsteira(esteira)
    } catch { }
  }
  getMemStore().esteiras[esteira.id] = esteira
  return esteira
}

export async function deletarEsteira(id: string): Promise<boolean> {
  if (isDbAvailable()) {
    try {
      return await dbDeletarEsteira(id)
    } catch { }
  }
  const store = getMemStore()
  if (!store.esteiras[id]) return false
  delete store.esteiras[id]
  return true
}
