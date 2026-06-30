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

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return hash
}

function gerarCor(nome: string): string {
  return `hsl(${Math.abs(hashCode(nome)) % 360}, 65%, 55%)`
}

function criarSeedData(): AppState {
  const hoje = new Date()
  const hojeStr = hoje.toISOString().split('T')[0]
  const d1Data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1).toISOString().split('T')[0]
  const d3Data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 3).toISOString().split('T')[0]
  const d5Data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 5).toISOString().split('T')[0]
  const d7Data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 7).toISOString().split('T')[0]
  const agora = new Date().toISOString()

  const numerosSeed: NumeroSendpulse[] = [
    { id: 'num_001', numero: '+5511999990000', nome: 'SB Receptivo ODD 100x', descricao: 'WhatsApp SuperBet', status: 'ativo', inboxTotal: 127, inboxNaoLidas: 3 },
    { id: 'num_002', numero: '+5511999991111', nome: 'MGM Geral', descricao: 'WhatsApp BetMGM', status: 'ativo', inboxTotal: 58, inboxNaoLidas: 0 },
    { id: 'num_003', numero: '+5511999992222', nome: 'Esportiva Bet VIP', descricao: 'WhatsApp EsportivaBet', status: 'ativo', inboxTotal: 34, inboxNaoLidas: 7 },
  ]

  const casaSB: CasaAposta = { id: 'casa_superbet', nome: 'SuperBet', slug: 'superbet', cor: gerarCor('SuperBet'), variaveis: { siteid: '12345', c: 'super_abc' }, paineisCPA: [], funilIds: ['F26.02'] }
  const casaMGM: CasaAposta = { id: 'casa_betmgm', nome: 'BetMGM', slug: 'betmgm', cor: gerarCor('BetMGM'), variaveis: { siteid: '67890', c: 'mgm_xyz' }, paineisCPA: [], funilIds: ['F27.01'] }
  const casaEB: CasaAposta = { id: 'casa_esportivabet', nome: 'EsportivaBet', slug: 'esportivabet', cor: gerarCor('EsportivaBet'), variaveis: { siteid: '55555', c: 'esport_abc' }, paineisCPA: [], funilIds: [] }

  const casas: Record<string, CasaAposta> = {
    [casaSB.id]: casaSB,
    [casaMGM.id]: casaMGM,
    [casaEB.id]: casaEB,
  }

  const esteira1Id = 'esteira_001'

  const disparos: Record<string, Disparo> = {
    seed_d1: {
      id: 'seed_d1',
      tipo: 'D1',
      nomenclatura: `[${hojeStr.slice(5)}] D1 ${d1Data.slice(5)} BASE SB`,
      status: 'pronto',
      casasAposta: [casaSB.id],
      dataDisparo: d1Data,
      horarioDisparo: '09:30',
      base: { status: 'disponivel', nomeArquivo: 'base_superbet.csv', totalRegistros: 4821 },
      templateDaxx: { id: 'tpl_001', nome: 'Template ODD 100x', url: 'https://daxx.example.com/tpl/001' },
      numerosSendpulse: [numerosSeed[0]],
      esteiraPaiId: esteira1Id,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    seed_d3: {
      id: 'seed_d3',
      tipo: 'D3',
      nomenclatura: `[${hojeStr.slice(5)}] D3 ${d3Data.slice(5)} BASE SB`,
      status: 'rascunho',
      casasAposta: [casaSB.id],
      dataDisparo: d3Data,
      horarioDisparo: '09:30',
      base: { status: 'disponivel', nomeArquivo: 'base_superbet_d3.csv', totalRegistros: 4231 },
      esteiraPaiId: esteira1Id,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    seed_d5: {
      id: 'seed_d5',
      tipo: 'D5',
      nomenclatura: `[${hojeStr.slice(5)}] D5 ${d5Data.slice(5)} BASE SB`,
      status: 'rascunho',
      casasAposta: [casaSB.id],
      dataDisparo: d5Data,
      horarioDisparo: '09:30',
      base: { status: 'pendente' },
      esteiraPaiId: esteira1Id,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    seed_d7: {
      id: 'seed_d7',
      tipo: 'D7',
      nomenclatura: `[${hojeStr.slice(5)}] D7 ${d7Data.slice(5)} BASE SB`,
      status: 'rascunho',
      casasAposta: [casaSB.id],
      dataDisparo: d7Data,
      horarioDisparo: '09:30',
      base: { status: 'pendente' },
      esteiraPaiId: esteira1Id,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    seed_pontual: {
      id: 'seed_pontual',
      tipo: 'PONTUAL',
      nomenclatura: `[${hojeStr.slice(5)}] PONTUAL ${hojeStr.slice(5)} BASE MGM`,
      status: 'pronto',
      casasAposta: [casaMGM.id],
      dataDisparo: hojeStr,
      horarioDisparo: '14:00',
      base: { status: 'disponivel', nomeArquivo: 'base_betmgm.csv', totalRegistros: 2150 },
      templateDaxx: { id: 'tpl_002', nome: 'Template Promo Geral', url: 'https://daxx.example.com/tpl/002' },
      numerosSendpulse: [numerosSeed[1]],
      criadoEm: agora,
      atualizadoEm: agora,
    },
  }

  const esteira: Esteira = {
    id: esteira1Id,
    nome: `[${hojeStr.slice(5)}] SB`,
    casasAposta: [casaSB.id],
    disparos: { d1: 'seed_d1', d3: 'seed_d3', d5: 'seed_d5', d7: 'seed_d7' },
    criadaEm: agora,
    atualizadoEm: agora,
    ativa: true,
  }

  const linkTemplates: Record<string, LinkTemplate> = {
    link_sb_cadastro: {
      id: 'link_sb_cadastro',
      casaId: casaSB.id,
      nome: 'Cadastro',
      urlTemplate: 'https://wlsuperbet.adsrv.eacdn.com/C.ashx?btag=a_{{siteid}}b_431c_&affid=761&siteid={{siteid}}&adid=431&c={{c}}',
      tipos: ['D1', 'D3', 'D5', 'D7'],
      criadoEm: agora,
      atualizadoEm: agora,
    },
    link_sb_fluxo: {
      id: 'link_sb_fluxo',
      casaId: casaSB.id,
      nome: 'Link do Fluxo',
      urlTemplate: 'https://wa.me/5511999990000?text=use{{siteid}}',
      tipos: ['D1'],
      criadoEm: agora,
      atualizadoEm: agora,
    },
    link_mgm_cadastro: {
      id: 'link_mgm_cadastro',
      casaId: casaMGM.id,
      nome: 'Cadastro',
      urlTemplate: 'https://mgm.adsrv.com/C.ashx?btag=a_{{siteid}}b_431c_&siteid={{siteid}}&c={{c}}',
      tipos: ['D1', 'D3', 'PONTUAL'],
      criadoEm: agora,
      atualizadoEm: agora,
    },
  }

  return {
    disparos,
    esteiras: { [esteira1Id]: esteira },
    casasAposta: casas,
    linkTemplates,
    numerosDisponiveis: numerosSeed,
    flowTagConfigs: {},
    pinnedNumeros: [],
    pinnedFunis: [],
    templatesDisponiveis: [
      { id: 'tpl_001', nome: 'Template ODD 100x', url: 'https://daxx.example.com/tpl/001' },
      { id: 'tpl_002', nome: 'Template Promo Geral', url: 'https://daxx.example.com/tpl/002' },
      { id: 'tpl_003', nome: 'Template Esportivas', url: 'https://daxx.example.com/tpl/003' },
    ],
  }
}

let cachedJson = ''
let cachedState: AppState | null = null

export function getState(): AppState {
  if (typeof window === 'undefined') return { ...ESTADO_INICIAL }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seed = criarSeedData()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
      cachedJson = JSON.stringify(seed)
      cachedState = seed
      return seed
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
      // migrar numeroSendpulse (singular) → numerosSendpulse (array)
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
    const seed = criarSeedData()
    return seed
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
