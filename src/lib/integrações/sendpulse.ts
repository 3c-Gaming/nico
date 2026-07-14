import type { NumeroSendpulse, FluxoSendpulse, ChatAtivoSendpulse, EstatisticasBotSendpulse } from '@/types'

const BASE_URL = 'https://api.sendpulse.com/whatsapp'
const API_KEY = process.env.SENDPULSE_API_KEY

function getHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
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

export async function listarNumeros(signal?: AbortSignal): Promise<NumeroSendpulse[]> {
  const res = await fetch(`${BASE_URL}/bots`, { headers: getHeaders(), signal })
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  return (json.data ?? []).map(mapearBotParaNumero)
}

export async function listarFluxos(botId: string, signal?: AbortSignal): Promise<FluxoSendpulse[]> {
  const res = await fetch(`${BASE_URL}/flows?bot_id=${encodeURIComponent(botId)}`, { headers: getHeaders(), signal })
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

export async function obterStatusBot(botId: string, signal?: AbortSignal): Promise<EstatisticasBotSendpulse> {
  const res = await fetch(`${BASE_URL}/bots/statistics?bot_id=${encodeURIComponent(botId)}`, { headers: getHeaders(), signal })
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  const d = json.data ?? {}
  return {
    totalInscritos: d.subscribed_total_count ?? 0,
    ativosInscritos: d.subscribed_active_count ?? 0,
    totalMensagensEnviadas: d.outgoing_messages_total_count ?? 0,
  }
}

export async function enviarMensagem(params: {
  botId: string
  telefone: string
  templateId?: string
  variaveis?: Record<string, string>
}): Promise<{ sucesso: boolean; mensagemId?: string }> {
  const res = await fetch(`${BASE_URL}/send`, {
    method: 'POST',
    headers: getHeaders(),
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
    headers: getHeaders(),
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
    headers: getHeaders(),
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

export async function listarChatsAtivos(
  botId: string,
  signal?: AbortSignal
): Promise<{ chats: ChatAtivoSendpulse[]; total: number }> {
  const res = await fetch(
    `${BASE_URL}/chats?bot_id=${encodeURIComponent(botId)}&limit=100`,
    { headers: getHeaders(), signal }
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
