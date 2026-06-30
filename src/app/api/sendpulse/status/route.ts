import { NextRequest, NextResponse } from 'next/server'
import { obterStatusBot } from '@/lib/integrações/sendpulse'

export async function GET(request: NextRequest) {
  const botId = request.nextUrl.searchParams.get('bot_id')
  if (!botId) {
    return NextResponse.json({ error: 'bot_id é obrigatório' }, { status: 400 })
  }

  try {
    const stats = await obterStatusBot(botId, AbortSignal.timeout(15_000))
    return NextResponse.json({ stats })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
