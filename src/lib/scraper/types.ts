export type StatusInteracaoScrape = 'em_pico' | 'respondendo' | 'ocioso' | 'parado' | 'numero_caido'

export interface ScrapeChatInfo {
  contactNome: string
  ultimaAtividade: string
  ultimaMensagemTipo: 'incoming' | 'outgoing'
  tempoSemRespostaMin: number
}

export interface ScrapeResultadoNumero {
  botId: string
  status: StatusInteracaoScrape
  chatsAtivos: number
  ultimoChat?: ScrapeChatInfo
  volume5min: number
  erro?: string
}

export interface ScrapeResultado {
  timestamp: string
  numeros: ScrapeResultadoNumero[]
}
