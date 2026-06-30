import { NextRequest, NextResponse } from 'next/server'
import { listarChats } from '@/lib/integrações/liveChat'
import { listAvailableTools } from '@/lib/mcp/sendpulse'

export async function GET(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get('bot_id')

  if (!botId) {
    return NextResponse.json({ error: 'bot_id é obrigatório' }, { status: 400 })
  }

  try {
    const [tools, rest] = await Promise.all([
      listAvailableTools(),
      listarChats(botId, 1, 0),
    ])

    return NextResponse.json({
      botId,
      mcpTools: tools.filter(t => t.name.startsWith('chatbots_')),
      restTotal: rest.meta.total,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
