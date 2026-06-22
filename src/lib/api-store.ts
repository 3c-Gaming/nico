import type { Disparo, Esteira } from '@/types'

// Módulo compartilhado entre as rotas de API (MVP — não persiste entre restarts)
declare global {
  var __NICO_STORE__:
    | { disparos: Record<string, Disparo>; esteiras: Record<string, Esteira> }
    | undefined
}

export function getApiStore() {
  if (!globalThis.__NICO_STORE__) {
    globalThis.__NICO_STORE__ = { disparos: {}, esteiras: {} }
  }
  return globalThis.__NICO_STORE__
}
