export type TipoDisparo = 'D1' | 'D3' | 'D5' | 'D7' | 'PONTUAL'

export type StatusDisparo =
  | 'rascunho'
  | 'pronto'
  | 'em_validacao'
  | 'executado'
  | 'cancelado'

export type StatusBase = 'pendente' | 'baixando' | 'disponivel' | 'erro'

export interface CasaAposta {
  id: string
  nome: string
  slug: string
  cor: string
}

export interface TemplateDaxx {
  id: string
  nome: string
  descricao?: string
  url?: string
}

export interface NumeroSendpulse {
  id: string
  numero: string
  chatbotId: string
  descricao?: string
}

export interface BaseCSV {
  leadhubId?: string
  nomeArquivo?: string
  totalRegistros?: number
  status: StatusBase
  baixadoEm?: string
  caminhoLocal?: string
  erro?: string
}

export interface Disparo {
  id: string
  tipo: TipoDisparo
  nomenclatura: string
  status: StatusDisparo
  casasAposta: string[]
  dataDisparo: string
  horarioDisparo: string
  base: BaseCSV
  templateDaxx?: TemplateDaxx
  numeroSendpulse?: NumeroSendpulse
  esteiraPaiId?: string
  criadoEm: string
  atualizadoEm: string
  notas?: string
}

export interface Esteira {
  id: string
  nome: string
  casasAposta: string[]
  disparos: {
    d1: string
    d3?: string
    d5?: string
    d7?: string
  }
  criadaEm: string
  atualizadoEm: string
  ativa: boolean
}

export interface AppState {
  disparos: Record<string, Disparo>
  esteiras: Record<string, Esteira>
  casasAposta: Record<string, CasaAposta>
  numerosDisponiveis: NumeroSendpulse[]
  templatesDisponiveis: TemplateDaxx[]
  ultimaSync?: string
}
