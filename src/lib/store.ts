'use client'

import type { AppState, CasaAposta, Disparo, Esteira, FlowTagConfig, LinkTemplate, NumeroSendpulse, PainelCPA } from '@/types'

const STORAGE_KEY = 'nico_app_state'

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
}

let cachedJson = ''
let cachedState: AppState | null = null

export function getState(): AppState {
  if (typeof window === 'undefined') return { ...ESTADO_INICIAL }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const vazio = { ...ESTADO_INICIAL }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vazio))
      cachedJson = JSON.stringify(vazio)
      cachedState = vazio
      return vazio
    }
    if (raw !== cachedJson) {
      cachedJson = raw
      const parsed = JSON.parse(raw) as AppState
      if (!parsed.linkTemplates) parsed.linkTemplates = {}
      if (!parsed.flowTagConfigs) parsed.flowTagConfigs = {}
      if (!parsed.pinnedNumeros) parsed.pinnedNumeros = []
      if (!parsed.pinnedFunis) parsed.pinnedFunis = []
      for (const c of Object.values(parsed.casasAposta)) {
        if (!c.paineisCPA) (c as unknown as Record<string, unknown>).paineisCPA = []
      }
      for (const d of Object.values(parsed.disparos)) {
        const old = d as unknown as Record<string, unknown>
        if (old.numeroSendpulse && !old.numerosSendpulse) {
          old.numerosSendpulse = [old.numeroSendpulse]
          delete old.numeroSendpulse
        }
      }
      cachedState = parsed
    }
    return cachedState!
  } catch {
    return { ...ESTADO_INICIAL }
  }
}

export function setState(state: AppState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(new CustomEvent('nico:state-changed'))
}

export function patchDisparos(disparos: Partial<Record<string, Disparo>>): void {
  const state = getState()
  for (const [id, data] of Object.entries(disparos)) {
    if (data) {
      state.disparos[id] = { ...state.disparos[id], ...data, atualizadoEm: new Date().toISOString() }
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
}

export function updateCasaAposta(id: string, data: Partial<CasaAposta>): void {
  const state = getState()
  if (state.casasAposta[id]) {
    state.casasAposta[id] = { ...state.casasAposta[id], ...data }
    setState(state)
  }
}

export function addLinkTemplate(template: LinkTemplate): void {
  const state = getState()
  state.linkTemplates[template.id] = template
  setState(state)
}

export function updateLinkTemplate(id: string, data: Partial<LinkTemplate>): void {
  const state = getState()
  if (state.linkTemplates[id]) {
    state.linkTemplates[id] = { ...state.linkTemplates[id], ...data, atualizadoEm: new Date().toISOString() }
    setState(state)
  }
}

export function deletarLinkTemplate(id: string): void {
  const state = getState()
  delete state.linkTemplates[id]
  setState(state)
}

export function updateFlowTagConfig(config: FlowTagConfig): void {
  const state = getState()
  state.flowTagConfigs[config.flowId] = config
  setState(state)
}

export function deleteFlowTagConfig(flowId: string): void {
  const state = getState()
  delete state.flowTagConfigs[flowId]
  setState(state)
}

export function updatePaineisCPA(casaId: string, paineis: PainelCPA[]): void {
  const state = getState()
  if (state.casasAposta[casaId]) {
    state.casasAposta[casaId].paineisCPA = paineis
    setState(state)
  }
}

export function updateVariaveisCasa(casaId: string, variaveis: Record<string, string>): void {
  const state = getState()
  if (state.casasAposta[casaId]) {
    state.casasAposta[casaId].variaveis = variaveis
    setState(state)
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
