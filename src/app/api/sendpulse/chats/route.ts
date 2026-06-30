import { NextRequest, NextResponse } from 'next/server'
import { listarChatsAtivos } from '@/lib/integrações/sendpulse'

export async function GET(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get('bot_id')
  if (!botId) {
    return NextResponse.json({ error: 'bot_id é obrigatório' }, { status: 400 })
  }

  try {
    const { chats, total } = await listarChatsAtivos(botId, AbortSignal.timeout(15_000))
    return NextResponse.json({ chats, total })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
