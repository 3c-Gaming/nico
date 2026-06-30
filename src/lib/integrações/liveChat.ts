import type { ChatAtivoSendpulse } from '@/types'

const BASE_URL = 'https://api.sendpulse.com/whatsapp'
const API_KEY = process.env.SENDPULSE_API_KEY

const PAGE_SIZE = 200
const MAX_PAGES_ABSOLUTE = 20
const CONCURRENCY = 5

interface MonitoramentoChatResult {
  chats: ChatAtivoSendpulse[]
  total: number
  totalNaoLidas: number
  volumeUltimos5Min: number
  volumeUltimaHora: number
  volumeHoje: number
  volumeOutbox5Min: number
  chatsScanned: number
  chatsTotal: number
}

interface Janelas {
  inicioHoje: number
  cincoMinAtras: number
  umaHoraAtras: number
}

function getHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  }
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

function traduzirChat(chatData: Record<string, unknown>): ChatAtivoSendpulse {
  const contact = (chatData.contact ?? {}) as Record<string, unknown>
  const channelData = (contact.channel_data ?? {}) as Record<string, string | undefined>
  const inboxLastMessage = chatData.inbox_last_message as Record<string, unknown> | undefined
  const outboxLastMessage = chatData.outbox_last_message as Record<string, unknown> | undefined
  return {
    contactId: String(contact.id ?? ''),
    contactNome: channelData.name ?? channelData.first_name ?? '',
    contactTelefone: channelData.username ?? '',
    ultimaMensagem: extrairTexto(inboxLastMessage),
    ultimaAtividade: (contact.last_activity_at as string) ?? (inboxLastMessage?.created_at as string) ?? '',
    ultimaAtividadeBot: outboxLastMessage?.created_at as string | undefined,
    naoLidas: (chatData.inbox_unread as number) ?? 0,
    chatAberto: (chatData.is_chat_opened as boolean) ?? false,
  }
}

export async function listarChats(
  botId: string,
  size = PAGE_SIZE,
  skip = 0,
  signal?: AbortSignal
): Promise<{ chats: ChatAtivoSendpulse[]; meta: { total: number } }> {
  const res = await fetch(
    `${BASE_URL}/chats?bot_id=${encodeURIComponent(botId)}&size=${size}&skip=${skip}`,
    { headers: getHeaders(), signal }
  )
  if (!res.ok) throw new Error(`WhatsApp API error: ${res.status}`)
  const json = (await res.json()) as {
    data?: Record<string, unknown>[]
    meta?: { total?: number }
  }
  const total: number = json.meta?.total ?? 0
  const chats: ChatAtivoSendpulse[] = (json.data ?? []).map(traduzirChat)
  return { chats, meta: { total } }
}

function calcularMetricas(
  chats: ChatAtivoSendpulse[],
  totalGeral: number,
  janelas: Janelas
): MonitoramentoChatResult {
  const { inicioHoje, cincoMinAtras, umaHoraAtras } = janelas
  let totalNaoLidas = 0
  let volumeUltimos5Min = 0
  let volumeUltimaHora = 0
  let volumeHoje = 0
  let volumeOutbox5Min = 0

  for (const chat of chats) {
    totalNaoLidas += chat.naoLidas
    const t = new Date(chat.ultimaAtividade).getTime()
    if (!isNaN(t)) {
      if (t >= cincoMinAtras) volumeUltimos5Min++
      if (t >= umaHoraAtras) volumeUltimaHora++
      if (t >= inicioHoje) volumeHoje++
    }
    const tBot = chat.ultimaAtividadeBot ? new Date(chat.ultimaAtividadeBot).getTime() : NaN
    if (!isNaN(tBot) && tBot >= cincoMinAtras) volumeOutbox5Min++
  }

  return {
    chats,
    total: totalGeral,
    totalNaoLidas,
    volumeUltimos5Min,
    volumeUltimaHora,
    volumeHoje,
    volumeOutbox5Min,
    chatsScanned: chats.length,
    chatsTotal: totalGeral,
  }
}

export async function listarChatsCompletos(botId: string, signal?: AbortSignal): Promise<MonitoramentoChatResult> {
  const agora = Date.now()
  const janelas: Janelas = {
    inicioHoje: new Date(agora).setHours(0, 0, 0, 0),
    cincoMinAtras: agora - 5 * 60 * 1000,
    umaHoraAtras: agora - 60 * 60 * 1000,
  }

  const todosChats: ChatAtivoSendpulse[] = []
  let totalGeral = 0

  // --- Page 0 (sequential) ---
  const page0 = await listarChats(botId, PAGE_SIZE, 0, signal)
  totalGeral = page0.meta.total
  todosChats.push(...page0.chats)

  if (page0.chats.length < PAGE_SIZE || totalGeral <= PAGE_SIZE) {
    return calcularMetricas(todosChats, totalGeral, janelas)
  }

  const ultimoPage0 = page0.chats[page0.chats.length - 1]
  const dataUltimo = new Date(ultimoPage0.ultimaAtividade).getTime()
  if (!isNaN(dataUltimo) && dataUltimo < janelas.inicioHoje) {
    return calcularMetricas(todosChats, totalGeral, janelas)
  }

  // --- Pages 1..N (parallel batches) ---
  const paginasTotais = Math.min(Math.ceil(totalGeral / PAGE_SIZE), MAX_PAGES_ABSOLUTE)

  for (let baseSkip = PAGE_SIZE; baseSkip < paginasTotais * PAGE_SIZE; baseSkip += PAGE_SIZE * CONCURRENCY) {
    if (signal?.aborted) break

    const skips: number[] = []
    for (let i = 0; i < CONCURRENCY; i++) {
      const s = baseSkip + i * PAGE_SIZE
      if (s >= paginasTotais * PAGE_SIZE) break
      skips.push(s)
    }

    const results = await Promise.allSettled(
      skips.map(s => listarChats(botId, PAGE_SIZE, s, signal))
    )

    for (const r of results) {
      if (r.status === 'fulfilled') todosChats.push(...r.value.chats)
    }

    const batchNewest = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value.chats)
      .sort((a, b) => new Date(b.ultimaAtividade).getTime() - new Date(a.ultimaAtividade).getTime())[0]

    if (batchNewest) {
      const t = new Date(batchNewest.ultimaAtividade).getTime()
      if (!isNaN(t) && t < janelas.inicioHoje) break
    }
  }

  return calcularMetricas(todosChats, totalGeral, janelas)
}
