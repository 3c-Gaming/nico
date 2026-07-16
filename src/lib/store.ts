'use client'

import type { AppState, CacheMetrica, CasaAposta, Demanda, Disparo, Esteira, FlowTagConfig, LinkTemplate, NumeroSendpulse, PainelCPA, UsuarioResponsavel } from '@/types'

const ESTADO_INICIAL: AppState = {
  disparos: {},
  esteiras: {},
  casasAposta: {},
  linkTemplates: {},
  numerosDisponiveis: [],
  templatesDisponiveis: [],
  flowTagConfigs: {},
  pinnedNumeros: [],
  pinnedFunis: [],
  cacheMetricas: {},
  demandas: {},
  usuariosResponsaveis: {},
}

let cachedState: AppState | null = null

function syncToApi(path: string, method: string, body?: unknown) {
  fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
    .then((res) => {
      if (!res.ok) console.warn('[sync]', method, path, res.status)
    })
    .catch((err) => console.warn('[sync]', path, err))
}

let snapshotCache: AppState | null = null
let version = 0

export function getState(): AppState {
  if (typeof window === 'undefined') return { ...ESTADO_INICIAL }
  if (!cachedState) {
    cachedState = { ...ESTADO_INICIAL }
  }
  return cachedState
}

export function getSnapshot(): AppState {
  if (typeof window === 'undefined') return { ...ESTADO_INICIAL }
  if (!cachedState) {
    cachedState = { ...ESTADO_INICIAL }
    snapshotCache = { ...cachedState, demandas: { ...cachedState.demandas }, usuariosResponsaveis: { ...cachedState.usuariosResponsaveis } }
  }
  return snapshotCache!
}

export function bumpVersion(): void {
  version++
  snapshotCache = { ...cachedState!, demandas: { ...cachedState!.demandas }, usuariosResponsaveis: { ...cachedState!.usuariosResponsaveis } }
  window.dispatchEvent(new CustomEvent('nico:state-changed'))
}

export function setState(state: AppState): void {
  if (typeof window === 'undefined') return
  cachedState = state
  bumpVersion()
}

export function patchDisparos(disparos: Partial<Record<string, Disparo>>): void {
  const state = getState()
  for (const [id, data] of Object.entries(disparos)) {
    if (data) {
      state.disparos[id] = { ...state.disparos[id], ...data, atualizadoEm: new Date().toISOString() }
      syncToApi(`/api/disparos/${id}`, 'PUT', data)
    }
  }
  setState(state)
}

export function patchEsteiras(esteiras: Partial<Record<string, Esteira>>): void {
  const state = getState()
  for (const [id, data] of Object.entries(esteiras)) {
    if (data) {
      state.esteiras[id] = { ...state.esteiras[id], ...data, atualizadoEm: new Date().toISOString() }
    }
  }
  setState(state)
}

export function addCasaAposta(casa: CasaAposta): void {
  const state = getState()
  state.casasAposta[casa.id] = casa
  setState(state)
  syncToApi('/api/casas', 'POST', casa)
}

export function updateCasaAposta(id: string, data: Partial<CasaAposta>): void {
  const state = getState()
  if (state.casasAposta[id]) {
    state.casasAposta[id] = { ...state.casasAposta[id], ...data }
    setState(state)
    syncToApi('/api/casas', 'PUT', { id, ...data })
  }
}

export function addLinkTemplate(template: LinkTemplate): void {
  const state = getState()
  state.linkTemplates[template.id] = template
  setState(state)
  syncToApi('/api/link-templates', 'POST', template)
}

export function updateLinkTemplate(id: string, data: Partial<LinkTemplate>): void {
  const state = getState()
  if (state.linkTemplates[id]) {
    state.linkTemplates[id] = { ...state.linkTemplates[id], ...data, atualizadoEm: new Date().toISOString() }
    setState(state)
    syncToApi('/api/link-templates', 'PUT', { id, ...data })
  }
}

export function deletarLinkTemplate(id: string): void {
  const state = getState()
  delete state.linkTemplates[id]
  setState(state)
  syncToApi(`/api/link-templates?id=${id}`, 'DELETE')
}

export function updateFlowTagConfig(config: FlowTagConfig): void {
  const state = getState()
  state.flowTagConfigs[config.flowId] = { ...state.flowTagConfigs[config.flowId], ...config }
  setState(state)
  syncToApi('/api/flow-tag-configs', 'POST', config)
}

export function deleteFlowTagConfig(flowId: string): void {
  const state = getState()
  delete state.flowTagConfigs[flowId]
  setState(state)
  syncToApi(`/api/flow-tag-configs?flowId=${flowId}`, 'DELETE')
}

export function updatePaineisCPA(casaId: string, paineis: PainelCPA[]): void {
  const state = getState()
  if (state.casasAposta[casaId]) {
    state.casasAposta[casaId].paineisCPA = paineis
    setState(state)
    syncToApi('/api/casas', 'PUT', { id: casaId, paineisCPA: paineis })
  }
}

export function updateVariaveisCasa(casaId: string, variaveis: Record<string, string>): void {
  const state = getState()
  if (state.casasAposta[casaId]) {
    state.casasAposta[casaId].variaveis = variaveis
    setState(state)
    syncToApi('/api/casas', 'PUT', { id: casaId, variaveis })
  }
}

export function deletarDisparo(id: string): void {
  const state = getState()
  delete state.disparos[id]
  for (const esteiraId of Object.keys(state.esteiras)) {
    const esteira = state.esteiras[esteiraId]
    if (esteira.disparos.d1 === id) delete state.esteiras[esteiraId]
    else {
      if (esteira.disparos.d3 === id) esteira.disparos.d3 = undefined
      if (esteira.disparos.d5 === id) esteira.disparos.d5 = undefined
      if (esteira.disparos.d7 === id) esteira.disparos.d7 = undefined
    }
  }
  setState(state)
  syncToApi(`/api/disparos/${id}`, 'DELETE')
}

export function patchDemandas(demandas: Partial<Record<string, Demanda>>): void {
  const state = getState()
  for (const [id, data] of Object.entries(demandas)) {
    if (data) {
      state.demandas[id] = { ...state.demandas[id], ...data, atualizadoEm: new Date().toISOString() }
      syncToApi(`/api/demandas/${id}`, 'PUT', data)
    }
  }
  setState(state)
}

export function addDemanda(demanda: Demanda): void {
  const state = getState()
  state.demandas[demanda.id] = demanda
  setState(state)
  syncToApi('/api/demandas', 'POST', demanda)
}

export function deletarDemanda(id: string): void {
  const state = getState()
  delete state.demandas[id]
  setState(state)
  syncToApi(`/api/demandas/${id}`, 'DELETE')
}

export function addUsuarioResponsavel(usuario: UsuarioResponsavel): void {
  const state = getState()
  state.usuariosResponsaveis[usuario.id] = usuario
  setState(state)
  syncToApi('/api/usuarios-responsaveis', 'POST', usuario)
}

export function deletarUsuarioResponsavel(id: string): void {
  const state = getState()
  delete state.usuariosResponsaveis[id]
  setState(state)
  syncToApi(`/api/usuarios-responsaveis/${id}`, 'DELETE')
}

function syncPreferencias(pinnedNumeros: string[], pinnedFunis: string[]) {
  syncToApi('/api/preferencias', 'PUT', { pinnedNumeros, pinnedFunis })
}

export function togglePinNumero(id: string): void {
  const state = getState()
  const idx = state.pinnedNumeros.indexOf(id)
  if (idx >= 0) {
    state.pinnedNumeros.splice(idx, 1)
  } else {
    state.pinnedNumeros.push(id)
  }
  setState(state)
  syncPreferencias(state.pinnedNumeros, state.pinnedFunis)
}

export function togglePinFunil(nome: string): void {
  const state = getState()
  const idx = state.pinnedFunis.indexOf(nome)
  if (idx >= 0) {
    state.pinnedFunis.splice(idx, 1)
  } else {
    state.pinnedFunis.push(nome)
  }
  setState(state)
  syncPreferencias(state.pinnedNumeros, state.pinnedFunis)
}

export function updateCacheMetricas(metricas: CacheMetrica[]): void {
  const state = getState()
  for (const m of metricas) {
    state.cacheMetricas[m.funil] = m
  }
  setState(state)
  syncToApi('/api/cache-metricas', 'PUT', metricas)
}

export async function syncNumerosSendpulse(): Promise<NumeroSendpulse[]> {
  try {
    const res = await fetch('/api/sendpulse/numeros')
    if (!res.ok) throw new Error('Falha ao sincronizar números')
    const data = await res.json()
    const numeros: NumeroSendpulse[] = data.numeros
    const state = getState()
    state.numerosDisponiveis = numeros
    state.ultimaSync = new Date().toISOString()
    setState(state)
    return numeros
  } catch {
    return getState().numerosDisponiveis
  }
}
