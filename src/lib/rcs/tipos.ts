// Estrutura da mensagem RCS enviada pela Solvefy (mesma CPaaS do SMS).
// Body de referência: RCS-body-request.md — content.type 'text' | 'card'.
// Carrossel entra numa 2ª leva (falta o exemplo de body deles).

export type RcsSuggestion =
  | { type: 'OPEN_URL'; text: string; url: string }
  | { type: 'REPLY'; text: string; postbackData: string }

export type RcsMediaHeight = 'SHORT' | 'MEDIUM' | 'TALL'
export type RcsCardOrientation = 'VERTICAL' | 'HORIZONTAL'

export interface RcsCard {
  title?: string
  description?: string
  media?: { url: string; height: RcsMediaHeight }
  orientation?: RcsCardOrientation
  suggestions?: RcsSuggestion[]
}

/** `content` do body da Solvefy. Os campos de texto/URL podem conter tokens {{variavel}} que
 * são resolvidos por destinatário na hora do envio (mesmo esquema do SMS/Telegram). */
export type RcsContent =
  | { type: 'text'; text: string; suggestions?: RcsSuggestion[] }
  | { type: 'card'; card: RcsCard }

/** Fallback SMS nativo da Solvefy — disparado pelo cpaas quando o RCS não é entregue.
 * `text` aceita {{variavel}} e {{link}} (o link é a URL do 1º botão OPEN_URL do card). */
export interface RcsSmsFallback {
  enabled: boolean
  from: string
  text: string
}

/** Limite do `fallback.text` na Solvefy. */
export const LIMITE_FALLBACK_TEXT = 1377

export interface RcsTemplate {
  id: string
  nome: string
  tipo: 'text' | 'card'
  conteudo: RcsContent
  fallback?: RcsSmsFallback
  criadoEm?: string
}

export interface DestinatarioRcs {
  telefone: string
  variables?: Record<string, string>
}

export interface ResultadoEnvioRcs {
  telefone: string
  ok: boolean
  status?: string
  erro?: string
}

/** 2ª mensagem RCS, disparada quando o lead clica a suggestion REPLY da 1ª — a Solvefy não avisa
 * esse clique por webhook (confirmado testando ao vivo: só entrega status de entrega/leitura por
 * lá), mas o clique FICA registrado do lado deles e aparece consultando o status da mensagem
 * (GET /rcs/messages/{id} volta status: "clicked"). Por isso funciona por POLLING — um cron
 * confere as mensagens "aguardando clique" a cada poucos minutos, não por push em tempo real. */
export interface RcsReceptivo {
  ativo: boolean
  /** Mesmo formato do conteúdo principal (texto ou card com imagem) — sem suggestions: a Solvefy
   * não confirma clique de botão da 2ª mensagem, então ainda não dá pra montar um 3º hop. */
  conteudo: RcsContent
}

/** Custo fixo por envio de RCS (R$) — a Solvefy não retorna preço, é contrato fixo. */
export const CUSTO_RCS_POR_ENVIO = 0.13

/** Custo por SMS de fallback (R$) — cobrado quando o RCS não entrega e a Solvefy manda o SMS. */
export const CUSTO_FALLBACK_SMS = 0.078
