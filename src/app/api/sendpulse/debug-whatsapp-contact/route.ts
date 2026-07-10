import { NextRequest, NextResponse } from 'next/server'
import { listarChats } from '@/lib/integrações/liveChat'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

async function getClient() {
  const transport = new StreamableHTTPClientTransport(
    new URL(process.env.SENDPULSE_MCP || 'https://mcp.sendpulse.com/mcp'),
    {
      requestInit: {
        headers: {
          'Content-Type': 'application/json',
          'X-SP-ID': process.env.SENDPULSE_CLIENT_ID!,
          'X-SP-SECRET': process.env.SENDPULSE_CLIENT_SECRET!,
        },
      },
    },
  )
  const c = new Client({ name: 'nico-debug', version: '1.0.0' })
  await c.connect(transport)
  return c
}

export async function GET(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get('bot_id')
  const phone = request.nextUrl.searchParams.get('phone')
  const action = request.nextUrl.searchParams.get('action') || 'lista'

  if (!botId) {
    return NextResponse.json({ error: 'bot_id é obrigatório' }, { status: 400 })
  }

  try {
    if (action === 'lista') {
      const { chats, meta } = await listarChats(botId, 200, 0)
      return NextResponse.json({ botId, total: meta.total, returned: chats.length, chats })
    }

    if (action === 'lista_var_id') {
      if (!phone) return NextResponse.json({ error: 'phone é obrigatório' }, { status: 400 })
      const variableId = request.nextUrl.searchParams.get('var_id') || '1'
      const channel = request.nextUrl.searchParams.get('ch') || 'whatsapp'
      const mcp = await getClient()
      const result = await mcp.callTool({
        name: 'chatbots_contacts_list_by_var_id',
        arguments: { channel, variableId, variableValue: phone },
      })
      return NextResponse.json({ rawContent: JSON.stringify(result.content).slice(0, 2000) })
    }

    if (action === 'show_contact') {
      const contactId = request.nextUrl.searchParams.get('contact_id') || botId
      const mcp = await getClient()
      const result = await mcp.callTool({
        name: 'chatbots_contacts_show',
        arguments: { channel: 'messenger', id: contactId },
      })
      return NextResponse.json({ rawContent: JSON.stringify(result.content).slice(0, 3000) })
    }

    if (action === 'mcp_call') {
      const toolName = request.nextUrl.searchParams.get('tool') || 'chatbots_contacts_show'
      const mcp = await getClient()
      const result = await mcp.callTool({
        name: toolName,
        arguments: JSON.parse(request.nextUrl.searchParams.get('args') || '{}'),
      })
      return NextResponse.json({ rawContent: JSON.stringify(result.content).slice(0, 5000) })
    }

    if (action === 'dialogs') {
      const mcp = await getClient()
      const result = await mcp.callTool({ name: 'chatbots_dialogs_list', arguments: { limit: 100, offset: 0, order: 'desc' } })
      const cts = result.content as { type?: string; text?: string }[]
      const texto = cts.find(c => c.type === 'text')?.text || ''
      const parsed: any = JSON.parse(texto)
      const services: number[] = [...new Set<number>((parsed.list || []).map((d: any) => d.service))].sort()
      const whatsapp = (parsed.list || []).filter((d: any) => d.service === 2).slice(0, 20)
        .map((d: any) => ({
          id: d.id,
          bot_id: d.bot_id,
          contact_id: d.contact?.id,
          contact_name: d.contact?.full_name,
          last_msg: d.last_inbox_message?.date || d.last_outbox_message?.date || null,
        }))
      return NextResponse.json({ total: parsed.list?.length, services, whatsappCount: whatsapp.length, whatsapp })
    }

    if (action === 'stats') {
      const mcp = await getClient()
      const result = await mcp.callTool({
        name: 'chatbots_bots_statistics_show',
        arguments: { channel: 'whatsapp', botId },
      })
      const cts = result.content as { type?: string; text?: string }[]
      const texto = cts.find(c => c.type === 'text')?.text || ''
      const parsed: any = JSON.parse(texto)
      return NextResponse.json({ stats: parsed })
    }

    return NextResponse.json({ error: 'action inválida' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, stack: (err as Error).stack }, { status: 502 })
  }
}
