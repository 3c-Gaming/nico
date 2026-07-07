import type { ScrapeResultadoNumero, ScrapeChatInfo, StatusInteracaoScrape } from './types'

export interface DadosClassificador {
  chats: ScrapeChatInfo[]
  totalChats: number
  botOnline: boolean
}

function contarVolume5min(chats: ScrapeChatInfo[]): number {
  const agora = Date.now()
  return chats.filter((c) => {
    const diff = agora - new Date(c.ultimaAtividade).getTime()
    return diff < 5 * 60 * 1000
  }).length
}

function contarIncoming5min(chats: ScrapeChatInfo[]): number {
  const agora = Date.now()
  return chats.filter((c) => {
    const diff = agora - new Date(c.ultimaAtividade).getTime()
    return diff < 5 * 60 * 1000 && c.ultimaMensagemTipo === 'incoming'
  }).length
}

export function classificarStatus(dados: DadosClassificador): StatusInteracaoScrape {
  if (!dados.botOnline) return 'numero_caido'

  const topChat = dados.chats[0]
  if (!topChat) return 'ocioso'

  const incoming5min = contarIncoming5min(dados.chats)

  if (incoming5min >= 5 && topChat.ultimaMensagemTipo === 'incoming') {
    return 'em_pico'
  }

  if (topChat.ultimaMensagemTipo === 'outgoing') {
    return 'respondendo'
  }

  if (topChat.tempoSemRespostaMin < 30) {
    return 'ocioso'
  }

  return 'parado'
}

export function enriquecerComScrape(
  resultado: ScrapeResultadoNumero,
): { statusInteracao: StatusInteracaoScrape; volume5min: number } {
  return {
    statusInteracao: resultado.status,
    volume5min: resultado.volume5min,
  }
}
