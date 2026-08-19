import type { NumeroSendpulse, FluxoSendpulse, ChatAtivoSendpulse, EstatisticasBotSendpulse } from '@/types'
import { listarContasSendpulse, registrarContaDoBot, registrarCanalDoBot, apiKeyParaBot } from './contasSendpulse'
import { hojeBrasilISO, dataParaBrasilISO } from '@/lib/datas'

export type Canal = 'whatsapp' | 'telegram'

// A SendPulse expõe um namespace REST quase idêntico por canal (confirmado testando ao vivo:
// /telegram/bots, /telegram/flows e /telegram/bots/statistics respondem com a mesma forma dos
// equivalentes /whatsapp/...) — só muda o channel_data de cada bot (telefone vs username/id do
// Telegram). Por isso quase tudo aqui vira um parametrizar-por-canal em vez de duplicar funções.
function baseUrl(canal: Canal): string {
  return `https://api.sendpulse.com/${canal}`
}

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
function mapearBotParaNumero(bot: any, canal: Canal): NumeroSendpulse {
  const numero = canal === 'telegram'
    ? (bot.channel_data?.username ? `@${bot.channel_data.username}` : String(bot.channel_data?.id ?? ''))
    : String(bot.channel_data?.phone ?? '')
  const nome = canal === 'telegram'
    ? (bot.channel_data?.full_name ?? bot.channel_data?.name ?? '')
    : (bot.channel_data?.name ?? '')
  return {
    id: bot.id,
    canal,
    numero,
    nome,
    status: traduzirStatusBot(bot.status),
    inboxTotal: bot.inbox?.total ?? 0,
    inboxNaoLidas: bot.inbox?.unread ?? 0,
  }
}

export async function listarNumeros(apiKey: string, canal: Canal, signal?: AbortSignal): Promise<NumeroSendpulse[]> {
  const res = await fetch(`${baseUrl(canal)}/bots`, { headers: getHeaders(apiKey), signal })
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  return (json.data ?? []).map((bot: unknown) => mapearBotParaNumero(bot, canal))
}

/** Busca números de TODAS as contas configuradas (e, por padrão, só do canal WhatsApp — passe
 * `canais` pra incluir Telegram também) em paralelo e mescla — uma conta ou canal falhando não
 * derruba os outros. Marca cada número com contaId/contaNome e registra o mapeamento bot->conta/
 * canal pra outras chamadas (fluxos, status, tags) saberem qual API key/canal usar sem precisar
 * buscar todos os números de novo. `signal` mantido na 1ª posição (não antes de `canais`) pra não
 * quebrar os vários call sites existentes que já chamam listarNumerosTodasContas(signal) — default
 * só-WhatsApp preserva o comportamento de todo chamador existente que não sabe de Telegram. */
export async function listarNumerosTodasContas(signal?: AbortSignal, canais: Canal[] = ['whatsapp']): Promise<NumeroSendpulse[]> {
  const contas = listarContasSendpulse()
  const resultados = await Promise.allSettled(
    contas.flatMap((conta) => canais.map((canal) =>
      listarNumeros(conta.apiKey, canal, signal).then((numeros) => ({ conta, numeros })),
    )),
  )

  const todos: NumeroSendpulse[] = []
  for (const r of resultados) {
    if (r.status !== 'fulfilled') continue
    const { conta, numeros } = r.value
    for (const numero of numeros) {
      registrarContaDoBot(numero.id, conta.id)
      registrarCanalDoBot(numero.id, numero.canal)
      todos.push({ ...numero, contaId: conta.id, contaNome: conta.nome })
    }
  }
  return todos
}

export interface StatusPlanoSendpulse {
  contaId: string
  contaNome: string
  tariffCode: string
  isExpired: boolean
  isExceeded: boolean
  expiredAt: string | null
  maxContacts: number
  maxBots: number
}

async function buscarStatusPlano(conta: { id: string; nome: string; apiKey: string }, signal?: AbortSignal): Promise<StatusPlanoSendpulse> {
  const res = await fetch(`${baseUrl('whatsapp')}/account`, { headers: getHeaders(conta.apiKey), signal })
  if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
  const json = await res.json()
  const t = json.data?.tariff ?? {}
  return {
    contaId: conta.id,
    contaNome: conta.nome,
    tariffCode: t.code ?? '',
    isExpired: !!t.is_expired,
    isExceeded: !!t.is_exceeded,
    expiredAt: t.expired_at ?? null,
    maxContacts: t.max_contacts ?? -1,
    maxBots: t.max_bots ?? -1,
  }
}

/** Status do plano/tarifa de todas as contas SendPulse configuradas — usado pra alertar
 * quando um plano já expirou ou está perto de expirar (a SendPulse não avisa sozinha). */
export async function buscarStatusPlanoTodasContas(signal?: AbortSignal): Promise<StatusPlanoSendpulse[]> {
  const contas = listarContasSendpulse()
  const resultados = await Promise.allSettled(contas.map((conta) => buscarStatusPlano(conta, signal)))
  return resultados
    .filter((r): r is PromiseFulfilledResult<StatusPlanoSendpulse> => r.status === 'fulfilled')
    .map((r) => r.value)
}

// canal por último (não antes de signal) pra não quebrar os call sites existentes que já passam
// um AbortSignal na 3ª posição — default 'whatsapp' preserva o comportamento de todos eles.
export async function listarFluxos(botId: string, apiKey: string, signal?: AbortSignal, canal: Canal = 'whatsapp'): Promise<FluxoSendpulse[]> {
  const res = await fetch(`${baseUrl(canal)}/flows?bot_id=${encodeURIComponent(botId)}`, { headers: getHeaders(apiKey), signal })
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

export async function obterStatusBot(botId: string, apiKey: string, signal?: AbortSignal, canal: Canal = 'whatsapp'): Promise<EstatisticasBotSendpulse> {
  const res = await fetch(`${baseUrl(canal)}/bots/statistics?bot_id=${encodeURIComponent(botId)}`, { headers: getHeaders(apiKey), signal })
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
 * Busca direto na API da SendPulse (getByTag) — `meta.total` já vem certo mesmo pedindo poucos
 * registros, e os contatos voltam ordenados do mais recente pro mais antigo, então os de hoje
 * sempre estão no topo da lista (sem risco de "sumir" mesmo em tags com milhares de contatos
 * acumulados), sem precisar paginar. Pra intervalos de mais de um dia, ver
 * `contarPorTagIntervaloSendpulse` — mesma ideia, mas pagina até cobrir o intervalo inteiro.
 */
export async function contarPorTagHojeSendpulse(botId: string, tag: string, apiKey: string, signal?: AbortSignal, canal: Canal = 'whatsapp'): Promise<ContagemTagHoje> {
  const url = `${baseUrl(canal)}/contacts/getByTag?bot_id=${encodeURIComponent(botId)}&tag=${encodeURIComponent(tag)}&size=1000`
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

export interface ContagemTagIntervalo {
  total: number
  ultimoLeadAt: string | null
}

const TAMANHO_PAGINA_GETBYTAG = 1000
// Teto de segurança pra paginação — 30 * 1000 = 30 mil contatos revisados no pior caso (intervalo
// bem antigo numa tag com muito volume desde então). Intervalos recentes (o uso normal) param bem
// antes disso.
const MAX_PAGINAS_GETBYTAG = 30

/**
 * Conta quantos contatos de uma tag entraram dentro de [dataInicio, dataFim] (datas YYYY-MM-DD,
 * fuso de Brasília, inclusive nos dois extremos) — direto na API da SendPulse (getByTag), sem
 * passar pelo LeadHub (função externa que filtrava a data no servidor, mas levava ~60-70s fixos
 * por chamada — muito mais lento que paginar aqui, confirmado ao vivo). A lista vem ordenada do
 * mais recente pro mais antigo (`skip` pagina por 1000, o máximo que a API aceita); paramos assim
 * que uma página inteira já é mais velha que `dataInicio` — não precisa varrer o histórico
 * inteiro da tag pra intervalos recentes, que é o uso normal.
 */
export async function contarPorTagIntervaloSendpulse(
  botId: string,
  tag: string,
  apiKey: string,
  dataInicio: string,
  dataFim: string,
  signal?: AbortSignal,
  canal: Canal = 'whatsapp',
): Promise<ContagemTagIntervalo> {
  let total = 0
  let ultimoLeadAt: string | null = null

  for (let pagina = 0; pagina < MAX_PAGINAS_GETBYTAG; pagina++) {
    const skip = pagina * TAMANHO_PAGINA_GETBYTAG
    const url = `${baseUrl(canal)}/contacts/getByTag?bot_id=${encodeURIComponent(botId)}&tag=${encodeURIComponent(tag)}&size=${TAMANHO_PAGINA_GETBYTAG}&skip=${skip}`
    const res = await fetch(url, { headers: getHeaders(apiKey), signal })
    if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contatos = (json.data ?? []) as any[]
    if (contatos.length === 0) break

    for (const contato of contatos) {
      const createdAt = String(contato.created_at ?? '')
      if (!createdAt) continue
      if (!ultimoLeadAt || createdAt > ultimoLeadAt) ultimoLeadAt = createdAt
      const dia = dataParaBrasilISO(createdAt)
      if (dia >= dataInicio && dia <= dataFim) total++
    }

    const maisVelhoDaPagina = dataParaBrasilISO(String(contatos[contatos.length - 1].created_at ?? ''))
    if (maisVelhoDaPagina < dataInicio) break // resto é só mais antigo — nenhuma página seguinte vai ter algo no intervalo
    if (contatos.length < TAMANHO_PAGINA_GETBYTAG) break // acabou a lista da tag
  }

  return { total, ultimoLeadAt }
}

/**
 * Mesma paginação/critério de parada de `contarPorTagIntervaloSendpulse`, mas devolve os
 * contact_ids em vez de só contar — usado pra varrer a conversa de cada um (ex: contagem de
 * cliques num botão específico), onde a contagem sozinha não basta.
 */
export interface ContatoNoIntervalo {
  id: string
  tags: string[]
}

export async function buscarContatosPorTagIntervaloSendpulse(
  botId: string,
  tag: string,
  apiKey: string,
  dataInicio: string,
  dataFim: string,
  signal?: AbortSignal,
  canal: Canal = 'whatsapp',
): Promise<ContatoNoIntervalo[]> {
  const contatosNoIntervalo: ContatoNoIntervalo[] = []

  for (let pagina = 0; pagina < MAX_PAGINAS_GETBYTAG; pagina++) {
    const skip = pagina * TAMANHO_PAGINA_GETBYTAG
    const url = `${baseUrl(canal)}/contacts/getByTag?bot_id=${encodeURIComponent(botId)}&tag=${encodeURIComponent(tag)}&size=${TAMANHO_PAGINA_GETBYTAG}&skip=${skip}`
    const res = await fetch(url, { headers: getHeaders(apiKey), signal })
    if (!res.ok) throw new Error(`Sendpulse API error: ${res.status}`)
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contatos = (json.data ?? []) as any[]
    if (contatos.length === 0) break

    for (const contato of contatos) {
      const createdAt = String(contato.created_at ?? '')
      if (!createdAt) continue
      const dia = dataParaBrasilISO(createdAt)
      if (dia >= dataInicio && dia <= dataFim) contatosNoIntervalo.push({ id: String(contato.id), tags: contato.tags ?? [] })
    }

    const maisVelhoDaPagina = dataParaBrasilISO(String(contatos[contatos.length - 1].created_at ?? ''))
    if (maisVelhoDaPagina < dataInicio) break
    if (contatos.length < TAMANHO_PAGINA_GETBYTAG) break
  }

  return contatosNoIntervalo
}

export async function enviarMensagem(params: {
  botId: string
  telefone: string
  templateId?: string
  variaveis?: Record<string, string>
}): Promise<{ sucesso: boolean; mensagemId?: string }> {
  const res = await fetch(`${baseUrl('whatsapp')}/send`, {
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

  const res = await fetch(`${baseUrl('whatsapp')}/flows/run`, {
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
  const res = await fetch(`${baseUrl('whatsapp')}/contacts/send`, {
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
    `${baseUrl('whatsapp')}/chats/messages?bot_id=${encodeURIComponent(params.botId)}&contact_id=${encodeURIComponent(params.contactId)}&limit=${params.limit ?? 50}`,
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
    const res = await fetch(`${baseUrl('whatsapp')}/contacts/get?id=${encodeURIComponent(contactId)}`, {
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
    `${baseUrl('whatsapp')}/chats?bot_id=${encodeURIComponent(botId)}&limit=100`,
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
