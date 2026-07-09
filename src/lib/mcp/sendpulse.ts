import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const MCP_URL = process.env.SENDPULSE_MCP || 'https://mcp.sendpulse.com/mcp'
const SP_ID = process.env.SENDPULSE_CLIENT_ID
const SP_SECRET = process.env.SENDPULSE_CLIENT_SECRET

function headersMCP(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (SP_ID && SP_SECRET) {
    h['X-SP-ID'] = SP_ID
    h['X-SP-SECRET'] = SP_SECRET
  }
  return h
}

let client: Client | null = null
let connectPromise: Promise<Client> | null = null

async function getClient(): Promise<Client> {
  if (client) return client
  if (connectPromise) return connectPromise

  connectPromise = (async () => {
    const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
      requestInit: { headers: headersMCP() },
    })

    const c = new Client({ name: 'nico-app', version: '1.0.0' })
    await c.connect(transport)
    client = c
    connectPromise = null
    return c
  })()

  return connectPromise
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

export async function listarTags(botId: string): Promise<TagInfo[]> {
  const mcp = await getClient()
  const result = await mcp.callTool({
    name: 'chatbots_bots_tags_list',
    arguments: {
      channel: 'whatsapp',
      botId,
    },
  })

  const texto = extrairTexto(result.content as unknown[])
  if (!texto) return []

  try {
    const parsed = JSON.parse(texto)
    const data = parsed.data ?? parsed ?? []
    if (!Array.isArray(data)) return []
    return data.map((t: Record<string, unknown>) => ({
      id: String(t.id ?? ''),
      name: String(t.name ?? ''),
      contactCount: Number(t.contact_count ?? 0),
    }))
  } catch {
    return []
  }
}

export async function listAvailableTools() {
  const mcp = await getClient()
  const result = await mcp.listTools()
  return result.tools.map(t => ({
    name: t.name,
    description: t.description?.slice(0, 120),
    inputSchema: t.inputSchema ? JSON.stringify(t.inputSchema).slice(0, 200) : null,
  }))
}

export async function runFlow(params: {
  channel: string
  contactId: string
  flowId: string
  externalData?: Record<string, unknown>
}) {
  const mcp = await getClient()
  const result = await mcp.callTool({
    name: 'chatbots_flows_run',
    arguments: {
      channel: params.channel,
      contactId: params.contactId,
      flowId: params.flowId,
      ...(params.externalData ? { externalData: params.externalData } : {}),
    },
  })
  return extrairTexto(result.content as unknown[])
}

export async function listChatMessages(params: {
  channel: string
  contactId: string
  limit?: number
  offset?: number
  order?: 'asc' | 'desc'
}) {
  const mcp = await getClient()
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
  return extrairTexto(result.content as unknown[])
}

export async function getContactInfo(contactId: string) {
  const mcp = await getClient()
  const result = await mcp.callTool({
    name: 'chatbots_contacts_show',
    arguments: {
      channel: 'messenger',
      id: contactId,
    },
  })

  const texto = extrairTexto(result.content as unknown[])
  if (!texto) return null

  try {
    return JSON.parse(texto)
  } catch {
    return null
  }
}
