'use client'

import type { AppState, CasaAposta, Disparo, Esteira } from '@/types'

const STORAGE_KEY = 'nico_app_state'

const ESTADO_INICIAL: AppState = {
  disparos: {},
  esteiras: {},
  casasAposta: {},
  numerosDisponiveis: [],
  templatesDisponiveis: [],
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
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const hojeStr = fmt(hoje)
  const d1Data = fmt(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1))
  const d3Data = fmt(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 3))
  const d5Data = fmt(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 5))
  const d7Data = fmt(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 7))

  const superBet: CasaAposta = { id: crypto.randomUUID(), nome: 'SuperBet', slug: 'superbet', cor: gerarCor('SuperBet') }
  const betMGM: CasaAposta = { id: crypto.randomUUID(), nome: 'BetMGM', slug: 'betmgm', cor: gerarCor('BetMGM') }
  const esportivaBet: CasaAposta = { id: crypto.randomUUID(), nome: 'EsportivaBet', slug: 'esportivabet', cor: gerarCor('EsportivaBet') }

  const casas: Record<string, CasaAposta> = {
    [superBet.id]: superBet,
    [betMGM.id]: betMGM,
    [esportivaBet.id]: esportivaBet,
  }

  const agora = new Date().toISOString()
  const d1Id = crypto.randomUUID()
  const d3Id = crypto.randomUUID()
  const d5Id = crypto.randomUUID()
  const d7Id = crypto.randomUUID()

  const esteira1Id = crypto.randomUUID()

  const disparos: Record<string, Disparo> = {
    [d1Id]: {
      id: d1Id,
      tipo: 'D1',
      nomenclatura: `[${hojeStr.slice(5)}] D1 ${d1Data.slice(5)} BASE SB`,
      status: 'pronto',
      casasAposta: [superBet.id],
      dataDisparo: d1Data,
      horarioDisparo: '09:30',
      base: { status: 'disponivel', nomeArquivo: 'base_superbet.csv', totalRegistros: 4821 },
      templateDaxx: { id: 'tpl_001', nome: 'Template ODD 100x', url: 'https://daxx.example.com/tpl/001' },
      numeroSendpulse: { id: 'num_001', numero: '+5511999990000', chatbotId: 'chat_001', descricao: 'SB Receptivo ODD 100x' },
      esteiraPaiId: esteira1Id,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    [d3Id]: {
      id: d3Id,
      tipo: 'D3',
      nomenclatura: `[${hojeStr.slice(5)}] D3 ${d3Data.slice(5)} BASE SB`,
      status: 'rascunho',
      casasAposta: [superBet.id],
      dataDisparo: d3Data,
      horarioDisparo: '09:30',
      base: { status: 'disponivel' },
      esteiraPaiId: esteira1Id,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    [d5Id]: {
      id: d5Id,
      tipo: 'D5',
      nomenclatura: `[${hojeStr.slice(5)}] D5 ${d5Data.slice(5)} BASE SB`,
      status: 'rascunho',
      casasAposta: [superBet.id],
      dataDisparo: d5Data,
      horarioDisparo: '09:30',
      base: { status: 'pendente' },
      esteiraPaiId: esteira1Id,
      criadoEm: agora,
      atualizadoEm: agora,
    },
    [d7Id]: {
      id: d7Id,
      tipo: 'D7',
      nomenclatura: `[${hojeStr.slice(5)}] D7 ${d7Data.slice(5)} BASE SB`,
      status: 'rascunho',
      casasAposta: [superBet.id],
      dataDisparo: d7Data,
      horarioDisparo: '09:30',
      base: { status: 'pendente' },
      esteiraPaiId: esteira1Id,
      criadoEm: agora,
      atualizadoEm: agora,
    },
  }

  const pontualId = crypto.randomUUID()
  disparos[pontualId] = {
    id: pontualId,
    tipo: 'PONTUAL',
    nomenclatura: `[${hojeStr.slice(5)}] PONTUAL ${hojeStr.slice(5)} BASE MGM`,
    status: 'pronto',
    casasAposta: [betMGM.id],
    dataDisparo: hojeStr,
    horarioDisparo: '14:00',
    base: { status: 'disponivel', nomeArquivo: 'base_betmgm.csv', totalRegistros: 2150 },
    templateDaxx: { id: 'tpl_002', nome: 'Template Promo Geral', url: 'https://daxx.example.com/tpl/002' },
    numeroSendpulse: { id: 'num_002', numero: '+5511999991111', chatbotId: 'chat_002', descricao: 'MGM Geral' },
    criadoEm: agora,
    atualizadoEm: agora,
  }

  const esteira: Esteira = {
    id: esteira1Id,
    nome: `[${hojeStr.slice(5)}] SB`,
    casasAposta: [superBet.id],
    disparos: { d1: d1Id, d3: d3Id, d5: d5Id, d7: d7Id },
    criadaEm: agora,
    atualizadoEm: agora,
    ativa: true,
  }

  return {
    disparos,
    esteiras: { [esteira1Id]: esteira },
    casasAposta: casas,
    numerosDisponiveis: [
      { id: 'num_001', numero: '+5511999990000', chatbotId: 'chat_001', descricao: 'SB Receptivo ODD 100x' },
      { id: 'num_002', numero: '+5511999991111', chatbotId: 'chat_002', descricao: 'MGM Geral' },
      { id: 'num_003', numero: '+5511999992222', chatbotId: 'chat_003', descricao: 'Esportiva Bet VIP' },
    ],
    templatesDisponiveis: [
      { id: 'tpl_001', nome: 'Template ODD 100x', url: 'https://daxx.example.com/tpl/001' },
      { id: 'tpl_002', nome: 'Template Promo Geral', url: 'https://daxx.example.com/tpl/002' },
      { id: 'tpl_003', nome: 'Template Esportivas', url: 'https://daxx.example.com/tpl/003' },
    ],
  }
}

export function getState(): AppState {
  if (typeof window === 'undefined') return { ...ESTADO_INICIAL, ...criarSeedData() }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seed = criarSeedData()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
      return seed
    }
    return JSON.parse(raw) as AppState
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
