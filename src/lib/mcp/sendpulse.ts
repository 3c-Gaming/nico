import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { listarContasSendpulse, contaParaBot, registrarContaDoBot, canalParaBot, registrarCanalDoBot, type ContaSendpulse } from '../integrações/contasSendpulse'

function headersMCP(conta: ContaSendpulse): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-SP-ID': conta.clientId,
    'X-SP-SECRET': conta.clientSecret,
  }
}

// Um client MCP por conta — cada conta SendPulse é um servidor MCP autenticado
// separadamente (X-SP-ID/X-SP-SECRET próprios), não dá pra reusar uma única conexão.
const clientes = new Map<string, Client>()
const conectando = new Map<string, Promise<Client>>()

async function getClient(conta: ContaSendpulse): Promise<Client> {
  const existente = clientes.get(conta.id)
  if (existente) return existente
  const emAndamento = conectando.get(conta.id)
  if (emAndamento) return emAndamento

  const promise = (async () => {
    const transport = new StreamableHTTPClientTransport(new URL(conta.mcpUrl), {
      requestInit: { headers: headersMCP(conta) },
    })
    const c = new Client({ name: 'nico-app', version: '1.0.0' })
    await c.connect(transport)
    clientes.set(conta.id, c)
    conectando.delete(conta.id)
    return c
  })()

  conectando.set(conta.id, promise)
  return promise
}

function extrairTexto(content: unknown[]): string {
  for (const item of content) {
    if (item && typeof item === 'object' && 'text' in (item as Record<string, unknown>)) {
      return String((item as Record<string, unknown>).text)
    }
  }
  return ''
}

export interface TagInfo {
  id: string
  name: string
  contactCount: number
}

async function buscarTagsDaConta(conta: ContaSendpulse, botId: string, canal: 'whatsapp' | 'telegram'): Promise<TagInfo[]> {
  const mcp = await getClient(conta)
  const result = await mcp.callTool({
    name: 'chatbots_bots_tags_list',
    arguments: {
      channel: canal,
      botId,
    },
  })

  const texto = extrairTexto(result.content as unknown[])

  // A MCP não lança exceção pra erro de execução da ferramenta — devolve isError:true com o
  // texto do erro no lugar do conteúdo normal (ex: bot de outra conta, bot desconectado,
  // erro 400). É esse isError que sinaliza "conta errada" pro retry em listarTags.
  if (result.isError) {
    throw new Error(texto || 'Tool execution failed')
  }
  if (!texto) return []

  try {
    const parsed = JSON.parse(texto)
    const data = parsed.data ?? parsed ?? []
    if (!Array.isArray(data)) return []
    return data.map((t: Record<string, unknown>) => ({
      id: String(t.id ?? ''),
      name: String(t.name ?? ''),
      contactCount: Number(t.count ?? t.contact_count ?? 0),
    }))
  } catch {
    return []
  }
}

/** Cada rota da API roda isolada como function serverless na Vercel — o palpite de
 * conta/canal (contaParaBot/canalParaBot) só é confiável dentro da mesma invocação que populou o
 * cache. Tenta o palpite primeiro e, se a ferramenta MCP der isError (conta ou canal errado),
 * tenta as outras combinações de conta×canal em sequência — sempre acerta, mesmo a frio. Sem
 * tentar os dois canais, um bot de Telegram nunca resolvia (a chamada saía sempre com
 * channel: 'whatsapp' fixo) e a lista de tags ficava vazia/"desconectado" pra ele. */
export async function listarTags(botId: string): Promise<TagInfo[]> {
  const contas = listarContasSendpulse()
  if (!contas.length) return []
  const palpiteConta = contaParaBot(botId)
  const ordemContas = palpiteConta ? [palpiteConta, ...contas.filter((c) => c.id !== palpiteConta.id)] : contas
  const palpiteCanal = canalParaBot(botId)
  const ordemCanais: ('whatsapp' | 'telegram')[] = palpiteCanal === 'telegram' ? ['telegram', 'whatsapp'] : ['whatsapp', 'telegram']

  let ultimoErro: unknown
  for (const conta of ordemContas) {
    for (const canal of ordemCanais) {
      try {
        const tags = await buscarTagsDaConta(conta, botId, canal)
        registrarContaDoBot(botId, conta.id)
        registrarCanalDoBot(botId, canal)
        return tags
      } catch (err) {
        ultimoErro = err
      }
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(`Nenhuma conta/canal SendPulse reconheceu o bot ${botId}`)
}

export async function listAvailableTools(contaId?: string) {
  const contas = listarContasSendpulse()
  const conta = contas.find((c) => c.id === contaId) ?? contas[0]
  if (!conta) return []
  const mcp = await getClient(conta)
  const result = await mcp.listTools()
  return result.tools.map(t => ({
    name: t.name,
    description: t.description?.slice(0, 120),
    inputSchema: t.inputSchema ? JSON.stringify(t.inputSchema).slice(0, 800) : null,
  }))
}

/** Sem bot_id nos parâmetros pra resolver a conta de antemão — tenta cada conta
 * configurada em sequência até uma responder com sucesso. */
async function tentarTodasContas<T>(fn: (conta: ContaSendpulse) => Promise<T>, ehVazio: (v: T) => boolean): Promise<T | null> {
  for (const conta of listarContasSendpulse()) {
    try {
      const valor = await fn(conta)
      if (!ehVazio(valor)) return valor
    } catch {
      // tenta a próxima conta
    }
  }
  return null
}

export async function runFlow(params: {
  channel: string
  contactId: string
  flowId: string
  externalData?: Record<string, unknown>
}) {
  const resultado = await tentarTodasContas(async (conta) => {
    const mcp = await getClient(conta)
    const result = await mcp.callTool({
      name: 'chatbots_flows_run',
      arguments: {
        channel: params.channel,
        contactId: params.contactId,
        flowId: params.flowId,
        ...(params.externalData ? { externalData: params.externalData } : {}),
      },
    })
    if (result.isError) throw new Error(extrairTexto(result.content as unknown[]) || 'Tool execution failed')
    return extrairTexto(result.content as unknown[])
  }, (v) => !v)
  return resultado ?? ''
}

export async function listChatMessages(params: {
  channel: string
  contactId: string
  limit?: number
  offset?: number
  order?: 'asc' | 'desc'
}) {
  const resultado = await tentarTodasContas(async (conta) => {
    const mcp = await getClient(conta)
    const result = await mcp.callTool({
      name: 'chatbots_chats_messages_list',
      arguments: {
        channel: params.channel,
        contactId: params.contactId,
        ...(params.limit !== undefined ? { limit: params.limit } : {}),
        ...(params.offset !== undefined ? { offset: params.offset } : {}),
        ...(params.order ? { order: params.order } : {}),
      },
    })
    if (result.isError) throw new Error(extrairTexto(result.content as unknown[]) || 'Tool execution failed')
    return extrairTexto(result.content as unknown[])
  }, (v) => !v)
  return resultado ?? ''
}

async function callContactsShow(channel: string, contactId: string) {
  return tentarTodasContas(async (conta) => {
    const mcp = await getClient(conta)
    const result = await mcp.callTool({
      name: 'chatbots_contacts_show',
      arguments: { channel, id: contactId },
    })

    const texto = extrairTexto(result.content as unknown[])
    if (!texto || texto.startsWith('Tool execution failed')) return null

    try {
      return JSON.parse(texto) as Record<string, unknown>
    } catch {
      return null
    }
  }, (v) => v === null)
}

export async function getContactInfo(contactId: string) {
  return callContactsShow('messenger', contactId)
}

export async function getContactWhatsApp(contactId: string) {
  return callContactsShow('whatsapp', contactId)
}
