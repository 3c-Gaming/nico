import type { Demanda, Disparo, Esteira, UsuarioResponsavel, UtmConfig, EsteiraEtapaConfig } from '@/types'
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
  listarDemandas as dbListarDemandas,
  getDemanda as dbGetDemanda,
  criarDemanda as dbCriarDemanda,
  atualizarDemanda as dbAtualizarDemanda,
  deletarDemanda as dbDeletarDemanda,
  listarUsuariosResponsaveis as dbListarUsuariosResponsaveis,
  criarUsuarioResponsavel as dbCriarUsuarioResponsavel,
  deletarUsuarioResponsavel as dbDeletarUsuarioResponsavel,
  listarUtmConfigs as dbListarUtmConfigs,
  criarUtmConfig as dbCriarUtmConfig,
  deletarUtmConfig as dbDeletarUtmConfig,
  atualizarUtmConfig as dbAtualizarUtmConfig,
  listarEtapaConfigs as dbListarEtapaConfigs,
  atualizarEtapaConfigs as dbAtualizarEtapaConfigs,
} from '@/lib/db/supabase'
import { migrarEsteiraParaEtapas } from '@/lib/store'

declare global {
  var __NICO_STORE__:
    | { disparos: Record<string, Disparo>; esteiras: Record<string, Esteira>; demandas: Record<string, Demanda>; usuariosResponsaveis: Record<string, UsuarioResponsavel>; utmConfigs: Record<string, UtmConfig>; etapaConfigs: EsteiraEtapaConfig[] }
    | undefined
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''

export function isDbAvailable(): boolean {
  return Boolean(SUPABASE_URL)
}

function getMemStore() {
  if (!globalThis.__NICO_STORE__) {
    globalThis.__NICO_STORE__ = { disparos: {}, esteiras: {}, demandas: {}, usuariosResponsaveis: {}, utmConfigs: {}, etapaConfigs: [] }
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
    if (e.etapas && e.etapas.length > 0) {
      const filtered = e.etapas.filter((et) => et.disparoId !== id)
      if (filtered.length === 0) { delete store.esteiras[esteiraId]; continue }
      if (filtered.length !== e.etapas.length)
        store.esteiras[esteiraId] = { ...e, etapas: filtered }
    }
    if (e.disparos.d1 === id || e.disparos.d3 === id || e.disparos.d5 === id || e.disparos.d7 === id) {
      delete store.esteiras[esteiraId]
    }
  }
  delete store.disparos[id]
  return true
}

// --- Demandas ---

export async function listarDemandas(): Promise<Demanda[]> {
  if (isDbAvailable()) {
    try {
      return await dbListarDemandas()
    } catch { }
  }
  return Object.values(getMemStore().demandas)
}

export async function getDemanda(id: string): Promise<Demanda | null> {
  if (isDbAvailable()) {
    try {
      return await dbGetDemanda(id)
    } catch { }
  }
  return getMemStore().demandas[id] ?? null
}

export async function criarDemanda(demanda: Demanda): Promise<Demanda> {
  if (isDbAvailable()) {
    try {
      return await dbCriarDemanda(demanda)
    } catch { }
  }
  getMemStore().demandas[demanda.id] = demanda
  return demanda
}

export async function atualizarDemanda(id: string, updates: Partial<Demanda>): Promise<Demanda | null> {
  if (isDbAvailable()) {
    try {
      return await dbAtualizarDemanda(id, updates)
    } catch { }
  }
  const store = getMemStore()
  if (!store.demandas[id]) return null
  store.demandas[id] = { ...store.demandas[id], ...updates, atualizadoEm: new Date().toISOString() }
  return store.demandas[id]
}

export async function deletarDemanda(id: string): Promise<boolean> {
  if (isDbAvailable()) {
    try {
      return await dbDeletarDemanda(id)
    } catch { }
  }
  const store = getMemStore()
  if (!store.demandas[id]) return false
  delete store.demandas[id]
  return true
}

// --- Usuarios Responsaveis ---

export async function listarUsuariosResponsaveis(): Promise<UsuarioResponsavel[]> {
  if (isDbAvailable()) {
    try {
      return await dbListarUsuariosResponsaveis()
    } catch { }
  }
  return Object.values(getMemStore().usuariosResponsaveis)
}

export async function criarUsuarioResponsavel(usuario: UsuarioResponsavel): Promise<UsuarioResponsavel> {
  if (isDbAvailable()) {
    try {
      return await dbCriarUsuarioResponsavel(usuario)
    } catch { }
  }
  getMemStore().usuariosResponsaveis[usuario.id] = usuario
  return usuario
}

export async function deletarUsuarioResponsavel(id: string): Promise<boolean> {
  if (isDbAvailable()) {
    try {
      return await dbDeletarUsuarioResponsavel(id)
    } catch { }
  }
  const store = getMemStore()
  if (!store.usuariosResponsaveis[id]) return false
  delete store.usuariosResponsaveis[id]
  return true
}

// --- Esteiras ---

export async function listarEsteiras(): Promise<Esteira[]> {
  let esteiras: Esteira[]
  if (isDbAvailable()) {
    try {
      esteiras = await dbListarEsteiras()
    } catch {
      esteiras = Object.values(getMemStore().esteiras).filter((e) => e.ativa)
    }
  } else {
    esteiras = Object.values(getMemStore().esteiras).filter((e) => e.ativa)
  }
  return esteiras.map((e) => migrarEsteiraParaEtapas(e))
}

export async function getEsteira(id: string): Promise<Esteira | null> {
  let esteira: Esteira | null = null
  if (isDbAvailable()) {
    try {
      esteira = await dbGetEsteira(id)
    } catch { }
  }
  if (!esteira) esteira = getMemStore().esteiras[id] ?? null
  if (!esteira) return null
  return migrarEsteiraParaEtapas(esteira)
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

// --- Utm Configs ---

export async function listarUtmConfigs(): Promise<UtmConfig[]> {
  if (isDbAvailable()) {
    try {
      return await dbListarUtmConfigs()
    } catch { }
  }
  return Object.values(getMemStore().utmConfigs)
}

export async function criarUtmConfig(config: UtmConfig): Promise<UtmConfig> {
  if (isDbAvailable()) {
    try {
      return await dbCriarUtmConfig(config)
    } catch { }
  }
  getMemStore().utmConfigs[config.id] = config
  return config
}

export async function atualizarUtmConfig(id: string, updates: Partial<UtmConfig>): Promise<UtmConfig | null> {
  if (isDbAvailable()) {
    try {
      return await dbAtualizarUtmConfig(id, updates)
    } catch { }
  }
  const store = getMemStore()
  if (!store.utmConfigs[id]) return null
  store.utmConfigs[id] = { ...store.utmConfigs[id], ...updates }
  return store.utmConfigs[id]
}

export async function deletarUtmConfig(id: string): Promise<boolean> {
  if (isDbAvailable()) {
    try {
      return await dbDeletarUtmConfig(id)
    } catch { }
  }
  const store = getMemStore()
  if (!store.utmConfigs[id]) return false
  delete store.utmConfigs[id]
  return true
}

// --- Etapa Configs ---

export async function listarEtapaConfigs(): Promise<EsteiraEtapaConfig[]> {
  if (isDbAvailable()) {
    try {
      return await dbListarEtapaConfigs()
    } catch { }
  }
  return getMemStore().etapaConfigs
}

export async function atualizarEtapaConfigs(configs: EsteiraEtapaConfig[]): Promise<EsteiraEtapaConfig[]> {
  if (isDbAvailable()) {
    try {
      return await dbAtualizarEtapaConfigs(configs)
    } catch { }
  }
  getMemStore().etapaConfigs = configs
  return configs
}
