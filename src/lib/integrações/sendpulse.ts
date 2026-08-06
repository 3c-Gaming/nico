import type { NumeroSendpulse, FluxoSendpulse, ChatAtivoSendpulse, EstatisticasBotSendpulse } from '@/types'
import { listarContasSendpulse, registrarContaDoBot, apiKeyParaBot } from './contasSendpulse'
import { hojeBrasilISO, dataParaBrasilISO } from '@/lib/datas'

const BASE_URL = 'https://api.sendpulse.com/whatsapp'

function getHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

function traduzirStatusBot(status: number): 'ativo' | 'inativo' {
  return status === 3 ? 'ativo' : 'inativo'
}

function traduzirStatusFlow(status: number): 'ativo' | 'inativo' | 'rascunho' {
  if (status === 1) return 'ativo'
  if (status === 2) return 'inativo'
  return 'rascunho'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearBotParaNumero(bot: any): NumeroSendpulse {
  return {
    id: bot.id,
    numero: String(bot.channel_data?.phone ?? ''),
    nome: bot.channel_data?.name ?? '',
    status: traduzirStatusBot(bot.status),
    inboxTotal: bot.inbox?.total ?? 0,
    inboxNaoLidas: bot.inbox?.unread ?? 0,
  }
}

export async function listarNumeros(apiKey: string, signal?: AbortSignal): Promise<NumeroSendpulse[]> {
  const res = await fetch(`${BASE_URL}/bots`, { headers: getHeaders(apiKey), signal })
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  return (json.data ?? []).map(mapearBotParaNumero)
}

/** Busca números de TODAS as contas configuradas em paralelo e mescla — uma conta
 * falhando não derruba as outras. Marca cada número com contaId/contaNome e registra
 * o mapeamento bot->conta pra outras chamadas (fluxos, status, tags) saberem qual
 * API key usar sem precisar buscar todos os números de novo. */
export async function listarNumerosTodasContas(signal?: AbortSignal): Promise<NumeroSendpulse[]> {
  const contas = listarContasSendpulse()
  const resultados = await Promise.allSettled(
    contas.map((conta) => listarNumeros(conta.apiKey, signal).then((numeros) => ({ conta, numeros }))),
  )

  const todos: NumeroSendpulse[] = []
  for (const r of resultados) {
    if (r.status !== 'fulfilled') continue
    const { conta, numeros } = r.value
    for (const numero of numeros) {
      registrarContaDoBot(numero.id, conta.id)
      todos.push({ ...numero, contaId: conta.id, contaNome: conta.nome })
    }
  }
  return todos
}

export async function listarFluxos(botId: string, apiKey: string, signal?: AbortSignal): Promise<FluxoSendpulse[]> {
  const res = await fetch(`${BASE_URL}/flows?bot_id=${encodeURIComponent(botId)}`, { headers: getHeaders(apiKey), signal })
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (json.data ?? []).map((flow: any) => ({
    id: flow.id,
    botId: flow.bot_id,
    nome: flow.name,
    status: traduzirStatusFlow(flow.status),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    triggers: (flow.triggers ?? []).map((t: any) => ({ id: t.id, nome: t.name, tipo: t.type })),
  }))
}

export async function obterStatusBot(botId: string, apiKey: string, signal?: AbortSignal): Promise<EstatisticasBotSendpulse> {
  const res = await fetch(`${BASE_URL}/bots/statistics?bot_id=${encodeURIComponent(botId)}`, { headers: getHeaders(apiKey), signal })
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  const d = json.data ?? {}
  return {
    totalInscritos: d.subscribed_total_count ?? 0,
    ativosInscritos: d.subscribed_active_count ?? 0,
    totalMensagensEnviadas: d.outgoing_messages_total_count ?? 0,
  }
}

export interface ContagemTagHoje {
  total: number
  hoje: number
  ultimoLeadAt: string | null
}

/**
 * Busca direto na API da SendPulse (getByTag) em vez do LeadHub (função externa) — bem mais
 * rápido: `meta.total` já vem certo mesmo pedindo poucos registros, e os contatos voltam
 * ordenados do mais recente pro mais antigo, então os de hoje sempre estão no topo da lista
 * (sem risco de "sumir" mesmo em tags com milhares de contatos acumulados).
 * Só serve pra "hoje" — não tem filtro de data pra consultar dias passados/futuros, porque
 * pra isso precisaria baixar a lista inteira da tag (poderia ser bem mais lento que o LeadHub,
 * que filtra a data no servidor).
 */
export async function contarPorTagHojeSendpulse(botId: string, tag: string, apiKey: string, signal?: AbortSignal): Promise<ContagemTagHoje> {
  const url = `${BASE_URL}/contacts/getByTag?bot_id=${encodeURIComponent(botId)}&tag=${encodeURIComponent(tag)}&size=1000`
  const res = await fetch(url, { headers: getHeaders(apiKey), signal })
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  const total = Number(json.meta?.total ?? 0)

  const hojeKey = hojeBrasilISO()
  let hoje = 0
  let ultimoLeadAt: string | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const contato of (json.data ?? []) as any[]) {
    const createdAt = String(contato.created_at ?? '')
    if (!createdAt) continue
    if (!ultimoLeadAt || createdAt > ultimoLeadAt) ultimoLeadAt = createdAt
    // Compara pelo dia em Brasília, não pela data crua (UTC) do timestamp da SendPulse —
    // do contrário um lead das 22h de Brasília (já 01h UTC do dia seguinte) fica de fora de "hoje".
    if (dataParaBrasilISO(createdAt) === hojeKey) hoje++
  }

  return { total, hoje, ultimoLeadAt }
}

export async function enviarMensagem(params: {
  botId: string
  telefone: string
  templateId?: string
  variaveis?: Record<string, string>
}): Promise<{ sucesso: boolean; mensagemId?: string }> {
  const res = await fetch(`${BASE_URL}/send`, {
    method: 'POST',
    headers: getHeaders(apiKeyParaBot(params.botId)),
    body: JSON.stringify({
      bot_id: params.botId,
      phone: params.telefone.replace(/\D/g, ''),
      template_id: params.templateId,
      variables: params.variaveis ?? {},
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Sendpulse send error ${res.status}: ${text}`)
  }
  const json = await res.json()
  return { sucesso: true, mensagemId: json.data?.id }
}

export async function executarFlow(params: {
  botId: string
  contactId: string
  flowId: string
  externalData?: Record<string, unknown>
}): Promise<{ success: boolean; rawBody?: unknown }> {
  const body: Record<string, unknown> = {
    bot_id: params.botId,
    contact_id: params.contactId,
    flow_id: params.flowId,
  }
  if (params.externalData) body.external_data = params.externalData

  const res = await fetch(`${BASE_URL}/flows/run`, {
    method: 'POST',
    headers: getHeaders(apiKeyParaBot(params.botId)),
    body: JSON.stringify(body),
  })
  const rawBody = await res.json().catch(() => null)
  if (!res.ok) {
    const text = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody)
    throw new Error(`Sendpulse flow run error ${res.status}: ${text}`)
  }
  return { success: rawBody?.success ?? true, rawBody }
}

function extrairTexto(msg: Record<string, unknown> | undefined): string | undefined {
  if (!msg) return undefined
  if (typeof msg.text === 'string') return msg.text
  const data = msg.data as Record<string, unknown> | undefined
  if (!data) return undefined
  const textObj = data.text as Record<string, unknown> | undefined
  if (textObj && typeof textObj.body === 'string') return textObj.body
  if (typeof data.text === 'string') return data.text
  const inter = data.interactive as Record<string, unknown> | undefined
  if (inter) {
    const btn = inter.button_reply as Record<string, unknown> | undefined
    if (btn && typeof btn.title === 'string') return btn.title
  }
  return undefined
}

export async function enviarMensagemDireta(params: {
  contactId: string
  botId: string
  texto: string
}): Promise<{ ok: boolean; statusCode: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}/contacts/send`, {
    method: 'POST',
    headers: getHeaders(apiKeyParaBot(params.botId)),
    body: JSON.stringify({
      contact_id: params.contactId,
      bot_id: params.botId,
      message: {
        type: 'text',
        text: { body: params.texto },
      },
    }),
  })
  const body = await res.json().catch(() => null)
  return { ok: res.ok, statusCode: res.status, body }
}

export async function obterMensagensChat(params: {
  botId: string
  contactId: string
  limit?: number
}): Promise<{ messages: { id: string; type: string; timestamp: number; text?: string }[] }> {
  const res = await fetch(
    `${BASE_URL}/chats/messages?bot_id=${encodeURIComponent(params.botId)}&contact_id=${encodeURIComponent(params.contactId)}&limit=${params.limit ?? 50}`,
    { headers: getHeaders(apiKeyParaBot(params.botId)) }
  )
  if (!res.ok) return { messages: [] }
  const json = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = (json.data ?? []).map((m: any) => ({
    id: m.id ?? '',
    type: m.type ?? '',
    timestamp: m.timestamp ?? 0,
    text: m.text ?? m.data?.text?.body ?? undefined,
  }))
  return { messages }
}

/** Sem bot_id pra resolver a conta de antemão — tenta cada conta configurada em
 * sequência até uma responder com sucesso (só usado em rota de debug). */
export async function obterTelefonePorContactId(contactId: string): Promise<string | null> {
  for (const conta of listarContasSendpulse()) {
    const res = await fetch(`${BASE_URL}/contacts/get?id=${encodeURIComponent(contactId)}`, {
      headers: getHeaders(conta.apiKey),
    })
    if (!res.ok) continue
    const json = await res.json()
    if (!json.success) continue
    const username = json.data?.channel_data?.username
    if (username) return String(username)
  }
  return null
}

export async function listarChatsAtivos(
  botId: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<{ chats: ChatAtivoSendpulse[]; total: number }> {
  const res = await fetch(
    `${BASE_URL}/chats?bot_id=${encodeURIComponent(botId)}&limit=100`,
    { headers: getHeaders(apiKey), signal }
  )
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  const total: number = json.meta?.total ?? 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chats: ChatAtivoSendpulse[] = (json.data ?? []).map((chat: any) => {
    const contact = chat.contact ?? {}
    const channelData = contact.channel_data ?? {}
    return {
      contactId: contact.id ?? '',
      contactNome: channelData.name ?? channelData.first_name ?? '',
      contactTelefone: channelData.username ?? '',
      ultimaMensagem: extrairTexto(chat.inbox_last_message),
      ultimaAtividade: chat.inbox_last_message?.created_at ?? '',
      naoLidas: chat.inbox_unread ?? 0,
      chatAberto: chat.is_chat_opened ?? false,
    }
  })

  return { chats, total }
}
